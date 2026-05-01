// Cron endpoint: fetches metrics for all pilots from Linkrunner, Mixpanel, Metabase
// Called every 12h by Vercel Cron (configured in vercel.json)
// Protected by CRON_SECRET header

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getLinkrunnerStats } from '@/lib/linkrunner'
import { getMixpanelInstalls } from '@/lib/mixpanel'
import { getQualifiedInstalls } from '@/lib/metabase'

// Metabase question ID that contains qualified installs
// You need to find this once (hit /api/metabase-questions to list all questions)
const QUALIFIED_INSTALLS_QUESTION_ID = parseInt(
  process.env.METABASE_QUALIFIED_QUESTION_ID ?? '0'
)

export async function GET(req: NextRequest) {
  // Auth check - must pass ?secret=CRON_SECRET or Authorization: Bearer CRON_SECRET
  const secret = req.nextUrl.searchParams.get('secret') ??
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

  const results = []
  const errors = []

  for (const pilot of pilots) {
    try {
      console.log(`Syncing pilot: ${pilot.name}`)

      // 1. Linkrunner - clicks + installs + retention
      const lrStats = await getLinkrunnerStats(pilot.linkrunner_campaign_name)

      // 2. Mixpanel - first app opens + phone numbers for matching
      const mpData = await getMixpanelInstalls(pilot.linkrunner_campaign_name)

      // 3. Metabase - qualified installs (cross-referenced by phone number)
      let qualifiedInstalls = 0
      if (QUALIFIED_INSTALLS_QUESTION_ID > 0) {
        qualifiedInstalls = await getQualifiedInstalls(
          mpData.phone_numbers,
          QUALIFIED_INSTALLS_QUESTION_ID
        )
      }

      // Write to Supabase cache
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

      results.push({ pilot: pilot.id, status: 'ok', qualifiedInstalls })
    } catch (err: any) {
      console.error(`Failed to sync ${pilot.name}:`, err)
      errors.push({ pilot: pilot.id, error: err?.message ?? String(err) })
    }
  }

  return NextResponse.json({
    synced_at: new Date().toISOString(),
    results,
    errors,
  })
}
