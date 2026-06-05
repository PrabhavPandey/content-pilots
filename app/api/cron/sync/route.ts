// Cron endpoint — daily sync for all pilots
// Protected by CRON_SECRET. Called by Vercel Cron and manually via ?secret=
//
// API call budget per sync run:
//   Linkrunner  : 1 call  (all campaigns fetched once, looked up by name)
//   Mixpanel    : 1 call  (all campaigns in one JQL query)
//   Metabase    : 1 call  (attributed phones → user profiles incl. job_role)
//   Gemini      : 0–N calls where N = new unique (company+role+type) combos
//                 (cached in Supabase forever — each combo classified at most once)
//   Supabase    : 1 read (pilots) + 1 read (classification cache) + N writes

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'

export const maxDuration = 300
import { getAllCampaignStats } from '@/lib/linkrunner'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'
import { isCityQualified, batchClassifyUsers, buildCacheKey, type CacheEntry } from '@/lib/gemini'

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

  const campaignNames = pilots.map(p => p.linkrunner_campaign_name?.toLowerCase().trim() ?? '')

  // ── Parallel: Linkrunner + Mixpanel ─────────────────────────────────────
  // Pass pilot campaign names so getAllCampaignStats only paginates past page 1 if a
  // pilot isn't found there (normally all pilots are on page 1 → single fast call).
  const [lrMap, mpMap] = await Promise.allSettled([
    getAllCampaignStats(campaignNames),
    getAllCampaignInstalls(campaignNames),
  ]).then(([lr, mp]) => [
    lr.status === 'fulfilled' ? lr.value : new Map(),
    mp.status === 'fulfilled' ? mp.value : new Map(),
  ] as const)

  // Collect all attributed phones across all campaigns
  const allAttributedPhones = new Set<string>()
  for (const name of campaignNames) {
    const bucket = (mpMap as Map<string, any>).get(name)
    bucket?.users.forEach((u: any) => { if (u.phone) allAttributedPhones.add(u.phone) })
  }

  // ── Metabase: fetch profiles (company + job_role) for attributed phones ──
  const metabaseUsers = allAttributedPhones.size > 0
    ? await getOnboardedUsers([...allAttributedPhones]).catch(() => [])
    : []

  console.log(`Linkrunner: ${(lrMap as Map<any,any>).size} campaigns | Metabase: ${(metabaseUsers as any[]).length} users`)

  // Build phone → profile map
  const phoneToMeta = new Map<string, {
    name: string | null
    company: string | null
    job_role: string | null
    linkedin: string | null
    onboarded_at: string | null
  }>()

  for (const u of metabaseUsers as any[]) {
    if (!u.phone) continue
    phoneToMeta.set(u.phone, {
      name:         u.name         ?? null,
      company:      u.company      ?? null,
      job_role:     u.job_role     ?? null,
      linkedin:     u.linkedin     ?? null,
      onboarded_at: u.onboarded_at ?? null,
    })
  }

  // ── Gemini: batch classify per pilot type ────────────────────────────────
  // Build user lists grouped by pilot type
  const ugcUsers:        Array<{ company: string; jobRole: string | null }> = []
  const influencerUsers: Array<{ company: string; jobRole: string | null }> = []

  for (const pilot of pilots) {
    const campaignKey = pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? ''
    const mpData = (mpMap as Map<string, any>).get(campaignKey) ?? { users: [] }
    const pilotType = pilot.type as 'ugc' | 'influencer'

    for (const mpUser of mpData.users) {
      const meta = phoneToMeta.get(mpUser.phone)
      if (!meta?.company) continue
      const entry = { company: meta.company.toLowerCase().trim(), jobRole: meta.job_role }
      if (pilotType === 'ugc') ugcUsers.push(entry)
      else influencerUsers.push(entry)
    }
  }

  const [ugcClassMap, influencerClassMap] = await Promise.all([
    ugcUsers.length > 0        ? batchClassifyUsers(ugcUsers,        'ugc',        db) : Promise.resolve(new Map<string, CacheEntry>()),
    influencerUsers.length > 0 ? batchClassifyUsers(influencerUsers, 'influencer', db) : Promise.resolve(new Map<string, CacheEntry>()),
  ])

  // ── Per-pilot qualification + parallel write ─────────────────────────────
  const syncedAt = new Date().toISOString()

  const settled = await Promise.allSettled(pilots.map(async pilot => {
    const campaignKey = pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? ''
    const pilotType   = pilot.type as 'ugc' | 'influencer'
    const classMap    = pilotType === 'ugc' ? ugcClassMap : influencerClassMap
    const lrStats     = (lrMap as Map<string, any>).get(campaignKey) ?? null
    const mpData      = (mpMap as Map<string, any>).get(campaignKey) ?? { first_app_opens: 0, users: [] }

    let qualifiedInstalls = 0
    const onboardedUsers: Array<{
      phone: string; city: string | null
      name: string | null; company: string | null; job_role: string | null
      linkedin: string | null; onboarded_at: string | null
      is_city_qualified: boolean; is_company_qualified: boolean; is_qualified: boolean
      gemini_reason: string | null
    }> = []

    for (const mpUser of mpData.users) {
      const meta = phoneToMeta.get(mpUser.phone)
      if (!meta) continue

      const cityOk       = isCityQualified(mpUser.city)
      const companyKey   = meta.company?.toLowerCase().trim() ?? ''
      const cacheKey     = buildCacheKey(companyKey, meta.job_role, pilotType)
      const entry        = companyKey ? classMap.get(cacheKey) : undefined
      const companyOk    = entry?.qualified ?? false
      const geminiReason = entry?.reason ?? null
      const isQualified  = companyOk  // city no longer gates qualification for any pilot type

      if (isQualified) qualifiedInstalls++

      onboardedUsers.push({
        phone:                mpUser.phone,
        city:                 mpUser.city        ?? null,
        name:                 meta.name,
        company:              meta.company,
        job_role:             meta.job_role,
        linkedin:             meta.linkedin,
        onboarded_at:         meta.onboarded_at,
        is_city_qualified:    cityOk,
        is_company_qualified: companyOk,
        is_qualified:         isQualified,
        gemini_reason:        geminiReason,
      })
    }

    // If Linkrunner was rate-limited (lrStats is null but map is empty), carry forward prev LR numbers
    const lrMapHasData = (lrMap as Map<string, any>).size > 0
    let finalLrClicks = lrStats?.clicks ?? 0
    let finalLrInstalls = lrStats?.installs ?? 0
    let finalLrSignups = lrStats?.signups ?? 0
    if (!lrMapHasData) {
      const { data: prevMetrics } = await db
        .from('pilot_metrics')
        .select('lr_clicks, lr_installs, lr_signups')
        .eq('pilot_id', pilot.id)
        .order('fetched_at', { ascending: false })
        .limit(1)
      finalLrClicks   = prevMetrics?.[0]?.lr_clicks   ?? 0
      finalLrInstalls = prevMetrics?.[0]?.lr_installs ?? 0
      finalLrSignups  = prevMetrics?.[0]?.lr_signups  ?? 0
    }

    console.log(`${pilot.name} [${pilotType}]: clicks=${finalLrClicks} installs=${finalLrInstalls} onboarded=${onboardedUsers.length} qualified=${qualifiedInstalls}${!lrMapHasData ? ' (LR rate-limited, carried forward)' : ''}`)

    const { error: metricsError } = await db.from('pilot_metrics').insert({
      pilot_id:           pilot.id,
      fetched_at:         syncedAt,
      lr_clicks:          finalLrClicks,
      lr_installs:        finalLrInstalls,
      lr_reinstalls:      0,
      lr_signups:         finalLrSignups,
      lr_conversion_rate: 0,
      lr_retention_d1:    0,
      lr_retention_d7:    0,
      mp_first_app_opens: mpData.first_app_opens,
      qualified_installs: qualifiedInstalls,
    })
    if (metricsError) throw metricsError

    // Refresh installs: delete + insert in parallel
    await db.from('pilot_installs').delete().eq('pilot_id', pilot.id)
    if (onboardedUsers.length > 0) {
      await db.from('pilot_installs').insert(
        onboardedUsers.map(u => ({ ...u, pilot_id: pilot.id, synced_at: syncedAt }))
      )
    }

    return { pilot: pilot.name, status: 'ok', qualifiedInstalls, onboarded: onboardedUsers.length }
  }))

  const results = settled.flatMap((r, i) =>
    r.status === 'fulfilled' ? [(r as PromiseFulfilledResult<any>).value] : []
  )
  const errors = settled.flatMap((r, i) =>
    r.status === 'rejected'
      ? [{ pilot: pilots[i]?.name, error: (r as PromiseRejectedResult).reason?.message ?? String((r as PromiseRejectedResult).reason) }]
      : []
  )

  return NextResponse.json({ synced_at: syncedAt, results, errors })
}
