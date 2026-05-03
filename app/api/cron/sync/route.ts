// Cron endpoint: syncs metrics for all pilots
// Called daily by Vercel Cron. Protected by CRON_SECRET.
//
// Gemini cost control:
//   We ONLY classify companies for users who (a) clicked a campaign link AND (b) onboarded.
//   This means Gemini calls scale with actual campaign traffic - not the full Metabase user base.
//   At zero traffic: 0 Gemini calls. At 100 attributed+onboarded users: ~20-30 unique companies.
//   Results are cached in Supabase so each company is only ever classified once.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getLinkrunnerStats } from '@/lib/linkrunner'
import { getMixpanelInstalls, MixpanelUser } from '@/lib/mixpanel'
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

  // ── Phase 1: Collect Mixpanel data for all pilots up front ──────────────
  // We need all attributed phones before hitting Metabase so we can filter efficiently.
  const pilotMpData = new Map<string, { first_app_opens: number; users: MixpanelUser[] }>()
  const allAttributedPhones = new Set<string>()

  for (const pilot of pilots) {
    const mpData = await getMixpanelInstalls(pilot.linkrunner_campaign_name)
    pilotMpData.set(pilot.id, mpData)
    mpData.users.forEach(u => { if (u.phone) allAttributedPhones.add(u.phone) })
  }
  console.log(`Mixpanel: ${allAttributedPhones.size} unique attributed phones across all pilots`)

  // ── Phase 2: Fetch Metabase users once ───────────────────────────────────
  let phoneToCompany = new Map<string, string>()
  try {
    const metabaseUsers = await getOnboardedUsers()
    console.log(`Metabase: ${metabaseUsers.length} onboarded users total`)

    // Build lookup: phone → company (only for users who are in our campaigns)
    for (const u of metabaseUsers) {
      if (u.phone && u.company && allAttributedPhones.has(u.phone)) {
        phoneToCompany.set(u.phone, u.company.toLowerCase().trim())
      }
    }
    console.log(`Metabase: ${phoneToCompany.size} phones matched to campaign-attributed users`)
  } catch (err) {
    console.error('Metabase fetch failed:', err)
  }

  // ── Phase 3: Classify ONLY companies of matched users ───────────────────
  // This is the key cost control: we never classify companies for people
  // who didn't click our campaign links. At zero traffic: 0 Gemini calls.
  const relevantCompanies = [...new Set(phoneToCompany.values())]
  console.log(`Gemini: classifying ${relevantCompanies.length} unique companies (campaign-attributed only)`)

  const companyMap = relevantCompanies.length > 0
    ? await batchClassifyCompanies(relevantCompanies, db)
    : new Map<string, boolean>()

  // ── Phase 4: Per-pilot metrics ────────────────────────────────────────────
  const results = []
  const errors = []

  for (const pilot of pilots) {
    try {
      const [lrStats, mpData] = await Promise.all([
        getLinkrunnerStats(pilot.linkrunner_campaign_name),
        Promise.resolve(pilotMpData.get(pilot.id)!),
      ])

      let qualifiedInstalls = 0
      for (const mpUser of mpData.users) {
        if (!isCityQualified(mpUser.city)) continue
        const companyKey = phoneToCompany.get(mpUser.phone)
        if (!companyKey) continue // didn't onboard
        if (!(companyMap.get(companyKey) ?? false)) continue // not a startup
        qualifiedInstalls++
      }

      console.log(`${pilot.name}: clicks=${lrStats?.clicks ?? 0} installs=${lrStats?.installs ?? 0} opens=${mpData.first_app_opens} qualified=${qualifiedInstalls}`)

      const { error: insertError } = await db.from('pilot_metrics').insert({
        pilot_id: pilot.id,
        fetched_at: new Date().toISOString(),
        lr_clicks: lrStats?.clicks ?? 0,
        lr_installs: lrStats?.installs ?? 0,
        lr_reinstalls: lrStats?.reinstalls ?? 0,
        lr_signups: lrStats?.signups ?? 0,
        lr_conversion_rate: lrStats?.conversion_rate ?? 0,
        lr_retention_d1: lrStats?.retention_d1 ?? 0,
        lr_retention_d7: lrStats?.retention_d7 ?? 0,
        mp_first_app_opens: mpData.first_app_opens,
        qualified_installs: qualifiedInstalls,
      })

      if (insertError) throw insertError
      results.push({ pilot: pilot.name, status: 'ok', qualifiedInstalls })
    } catch (err: any) {
      console.error(`Failed to sync ${pilot.name}:`, err)
      errors.push({ pilot: pilot.name, error: err?.message ?? String(err) })
    }
  }

  return NextResponse.json({ synced_at: new Date().toISOString(), results, errors })
}
