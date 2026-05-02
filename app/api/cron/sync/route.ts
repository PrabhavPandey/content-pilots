// Cron endpoint: fetches metrics for all pilots from Linkrunner, Mixpanel, Metabase
// Called daily by Vercel Cron (configured in vercel.json)
// Protected by CRON_SECRET query param or Authorization: Bearer header
//
// Qualification logic (3 layers):
//   1. City check (rule-based) - must be in a qualified metro
//   2. Onboarded check - must appear in Metabase question 498 (means they completed onboarding)
//   3. Company check (Gemini) - must be at a funded startup / tech company
//
// Data flow per pilot:
//   Mixpanel (campaign users with city) → phone match → Metabase (company) → Gemini → count

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getLinkrunnerStats } from '@/lib/linkrunner'
import { getMixpanelInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'
import { isCityQualified, batchClassifyCompanies } from '@/lib/gemini'

export async function GET(req: NextRequest) {
  // Auth check
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  // Fetch all active pilots
  const { data: pilots, error } = await db
    .from('pilots')
    .select('*')
    .eq('active', true)

  if (error || !pilots) {
    return NextResponse.json({ error: 'Failed to fetch pilots' }, { status: 500 })
  }

  // Fetch all onboarded users from Metabase ONCE (shared across all pilots)
  // question 498: phone + name + company for everyone who onboarded in the last 90 days
  let metabaseUsers: Awaited<ReturnType<typeof getOnboardedUsers>> = []
  try {
    metabaseUsers = await getOnboardedUsers()
    console.log(`Metabase: loaded ${metabaseUsers.length} onboarded users`)
  } catch (err) {
    console.error('Metabase fetch failed - qualified installs will be 0:', err)
  }

  // Build phone → MetabaseUser lookup map (normalized 10-digit phone as key)
  const phoneToMetabaseUser = new Map(
    metabaseUsers.map(u => [u.phone, u])
  )

  // Pre-classify all unique companies in one batch (hits Gemini once per unique company)
  const allCompanies = [
    ...new Set(
      metabaseUsers
        .map(u => u.company)
        .filter((c): c is string => Boolean(c))
    ),
  ]
  let companyQualificationMap = new Map<string, boolean>()
  try {
    companyQualificationMap = await batchClassifyCompanies(allCompanies)
    console.log(`Gemini: classified ${allCompanies.length} unique companies`)
  } catch (err) {
    console.error('Gemini batch classification failed:', err)
  }

  const results = []
  const errors = []

  for (const pilot of pilots) {
    try {
      console.log(`Syncing pilot: ${pilot.name}`)

      // 1. Linkrunner - clicks + installs
      const lrStats = await getLinkrunnerStats(pilot.linkrunner_campaign_name)

      // 2. Mixpanel - first app opens + per-user city data
      const mpData = await getMixpanelInstalls(pilot.linkrunner_campaign_name)

      // 3. Qualification: for each Mixpanel user attributed to this campaign,
      //    check city (layer 1) + onboarded in Metabase (layer 2) + startup company (layer 3)
      let qualifiedInstalls = 0

      for (const mpUser of mpData.users) {
        // Layer 1: city check
        if (!isCityQualified(mpUser.city)) continue

        // Layer 2: onboarded check - must appear in Metabase question 498
        const metaUser = phoneToMetabaseUser.get(mpUser.phone)
        if (!metaUser) continue

        // Layer 3: startup/company check via Gemini
        if (!metaUser.company) continue
        const companyKey = metaUser.company.toLowerCase().trim()
        const isStartup = companyQualificationMap.get(companyKey) ?? false
        if (!isStartup) continue

        qualifiedInstalls++
      }

      console.log(
        `  ${pilot.name}: lr=${lrStats?.clicks ?? 0} clicks, ` +
        `mp=${mpData.first_app_opens} first_opens, qualified=${qualifiedInstalls}`
      )

      // Write to Supabase
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

  return NextResponse.json({
    synced_at: new Date().toISOString(),
    results,
    errors,
  })
}
