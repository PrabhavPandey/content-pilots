// Cron endpoint — daily sync for all pilots
// Protected by CRON_SECRET. Called by Vercel Cron and manually via ?secret=
//
// API call budget per sync run:
//   Linkrunner  : 1 call  (all campaigns fetched once, looked up by name)
//   Mixpanel    : 1 call  (all 6 campaigns in one JQL query)
//   Metabase    : 1 call  (all onboarded users, phone+company)
//   Gemini      : 0–N calls where N = new unique companies from campaign-attributed users only
//                 (cached in Supabase forever — each company classified at most once)
//   Supabase    : 1 read (pilots) + 1 read (company cache) + 6 writes (metrics)

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getAllCampaignStats } from '@/lib/linkrunner'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'
import { isCityQualified, batchClassifyCompanies } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  const { data: pilots, error } = await db
    .from('pilots')
    .select('*')
    .eq('active', true)

  if (error || !pilots) {
    return NextResponse.json({ error: 'Failed to fetch pilots' }, { status: 500 })
  }

  // Normalize to lowercase - lrMap and mpMap both use lowercase keys
  const campaignNames = pilots.map(p => p.linkrunner_campaign_name?.toLowerCase().trim() ?? '')

  // ── 2 parallel API calls first: Linkrunner + Mixpanel ───────────────────
  const [lrMap, mpMap] = await Promise.allSettled([
    getAllCampaignStats(),
    getAllCampaignInstalls(campaignNames),
  ]).then(([lr, mp]) => [
    lr.status === 'fulfilled' ? lr.value : new Map(),
    mp.status === 'fulfilled' ? mp.value : new Map(),
  ] as const)

  // Collect all attributed phones from Mixpanel across all campaigns
  const allAttributedPhonesForMeta = new Set<string>()
  for (const name of campaignNames) {
    const bucket = (mpMap as Map<string, any>).get(name)
    bucket?.users.forEach((u: any) => { if (u.phone) allAttributedPhonesForMeta.add(u.phone) })
  }

  // ── Metabase: fetch profiles only for phones we actually care about ───────
  const metabaseUsers = allAttributedPhonesForMeta.size > 0
    ? await getOnboardedUsers([...allAttributedPhonesForMeta]).catch(() => [])
    : []

  console.log(`Linkrunner: ${(lrMap as Map<any,any>).size} campaigns | Metabase: ${(metabaseUsers as any[]).length} users`)
  console.log(`Linkrunner keys: [${[...(lrMap as Map<any,any>).keys()].join(', ')}]`)
  console.log(`Pilot campaign keys: [${campaignNames.join(', ')}]`)

  // Build phone lookup maps from Metabase results
  // (already pre-filtered to attributed phones only)
  const phoneToCompany = new Map<string, string>()
  const phoneToMeta = new Map<string, { name: string | null; company: string | null; linkedin: string | null; onboarded_at: string | null }>()

  for (const u of metabaseUsers as any[]) {
    if (!u.phone) continue
    if (u.company) phoneToCompany.set(u.phone, u.company.toLowerCase().trim())
    phoneToMeta.set(u.phone, { name: u.name ?? null, company: u.company ?? null, linkedin: u.linkedin ?? null, onboarded_at: u.onboarded_at ?? null })
  }

  // Gemini: only classify companies of attributed+onboarded users
  const relevantCompanies = [...new Set(phoneToCompany.values())]
  console.log(`Gemini: ${relevantCompanies.length} unique companies to classify (campaign-attributed only)`)

  const companyMap = relevantCompanies.length > 0
    ? await batchClassifyCompanies(relevantCompanies, db)
    : new Map<string, boolean>()

  // ── Per-pilot qualification + write ─────────────────────────────────────
  const results = []
  const errors = []

  for (const pilot of pilots) {
    try {
      const campaignKey = pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? ''
      const lrStats = (lrMap as Map<string, any>).get(campaignKey) ?? null
      const mpData = (mpMap as Map<string, any>).get(campaignKey) ?? { first_app_opens: 0, users: [] }

      let qualifiedInstalls = 0
      // Also collect onboarded users for pilot_installs table
      const onboardedUsers: Array<{
        phone: string; city: string | null
        name: string | null; company: string | null; linkedin: string | null; onboarded_at: string | null
        is_city_qualified: boolean; is_company_qualified: boolean; is_qualified: boolean
      }> = []

      for (const mpUser of mpData.users) {
        const meta = phoneToMeta.get(mpUser.phone)
        if (!meta) continue // not found in Metabase - hasn't onboarded

        const cityOk = isCityQualified(mpUser.city)
        const companyKey = phoneToCompany.get(mpUser.phone)
        const companyOk = companyKey ? (companyMap.get(companyKey) ?? false) : false
        const isQualified = cityOk && companyOk

        if (isQualified) qualifiedInstalls++

        onboardedUsers.push({
          phone:        mpUser.phone,
          city:         mpUser.city ?? null,
          name:         meta.name,
          company:      meta.company,
          linkedin:     meta.linkedin,
          onboarded_at: meta.onboarded_at,
          is_city_qualified:    cityOk,
          is_company_qualified: companyOk,
          is_qualified:         isQualified,
        })
      }

      console.log(`${pilot.name}: clicks=${lrStats?.clicks ?? 0} installs=${lrStats?.installs ?? 0} opens(MP)=${mpData.first_app_opens} onboarded=${onboardedUsers.length} qualified=${qualifiedInstalls}`)

      const syncedAt = new Date().toISOString()

      const { error: insertError } = await db.from('pilot_metrics').insert({
        pilot_id: pilot.id,
        fetched_at: syncedAt,
        lr_clicks:          lrStats?.clicks   ?? 0,
        lr_installs:        lrStats?.installs  ?? 0,
        lr_reinstalls:      0,
        lr_signups:         lrStats?.signups   ?? 0,
        lr_conversion_rate: 0,
        lr_retention_d1:    0,
        lr_retention_d7:    0,
        mp_first_app_opens: mpData.first_app_opens,
        qualified_installs: qualifiedInstalls,
      })

      if (insertError) throw insertError

      // Refresh pilot_installs: delete existing rows, insert fresh ones
      await db.from('pilot_installs').delete().eq('pilot_id', pilot.id)
      if (onboardedUsers.length > 0) {
        await db.from('pilot_installs').insert(
          onboardedUsers.map(u => ({ ...u, pilot_id: pilot.id, synced_at: syncedAt }))
        )
      }

      results.push({ pilot: pilot.name, status: 'ok', qualifiedInstalls, onboarded: onboardedUsers.length })
    } catch (err: any) {
      console.error(`Failed to sync ${pilot.name}:`, err)
      errors.push({ pilot: pilot.name, error: err?.message ?? String(err) })
    }
  }

  return NextResponse.json({ synced_at: new Date().toISOString(), results, errors })
}
