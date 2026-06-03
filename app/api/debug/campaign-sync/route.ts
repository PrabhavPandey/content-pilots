// Debug endpoint — tests each component of the campaign sync without writing to DB
// GET /api/debug/campaign-sync?secret=CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getCampaignStatsBySearch } from '@/lib/linkrunner'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { CAMPAIGN_META, getAllCreatorSlugs } from '@/lib/campaign-config'
import { getServiceClient } from '@/lib/db'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXTAUTH_URL:      !!process.env.NEXTAUTH_URL,
      CRON_SECRET:       !!process.env.CRON_SECRET,
      LINKRUNNER_API_KEY:!!process.env.LINKRUNNER_API_KEY,
      MIXPANEL_PROJECT_ID: process.env.MIXPANEL_PROJECT_ID ?? 'missing',
      SUPABASE_URL:      !!process.env.SUPABASE_URL,
    },
  }

  // ── 1. Linkrunner ─────────────────────────────────────────────────────────
  try {
    const t0  = Date.now()
    const map = await getAllCampaignStats()
    const ms  = Date.now() - t0
    const creatorSlugs = getAllCreatorSlugs()
    const found = creatorSlugs.filter(s => map.has(s))
    const missing = creatorSlugs.filter(s => !map.has(s))
    const sample = found.slice(0, 5).map(s => ({ slug: s, ...map.get(s) }))

    report.linkrunner = {
      ok: true,
      total_campaigns_returned: map.size,
      creator_slugs_found: found.length,
      creator_slugs_missing: missing,
      sample_stats: sample,
      ms,
    }
  } catch (err: any) {
    report.linkrunner = { ok: false, error: err?.message ?? String(err) }
  }

  // ── 2. Mixpanel ───────────────────────────────────────────────────────────
  try {
    const t0    = Date.now()
    const slugs = getAllCreatorSlugs()
    const map   = await getAllCampaignInstalls(slugs)
    const ms    = Date.now() - t0

    const perCreator = slugs.map(s => {
      const b = map.get(s)
      return { slug: s, users: b?.users?.length ?? 0, first_app_opens: b?.first_app_opens ?? 0 }
    }).filter(x => x.users > 0)

    report.mixpanel = {
      ok: true,
      creators_with_data: perCreator.length,
      total_attributed_phones: perCreator.reduce((n, x) => n + x.users, 0),
      per_creator: perCreator,
      ms,
    }
  } catch (err: any) {
    report.mixpanel = { ok: false, error: err?.message ?? String(err) }
  }

  // ── 3. Supabase — latest campaign_metrics ─────────────────────────────────
  try {
    const db = getServiceClient()
    const { data, error } = await db
      .from('campaign_metrics')
      .select('campaign_slug, fetched_at, lr_clicks, lr_installs, qualified_installs')
      .order('fetched_at', { ascending: false })
      .limit(10)

    report.supabase_latest_metrics = error
      ? { ok: false, error: error.message }
      : { ok: true, rows: data }
  } catch (err: any) {
    report.supabase_latest_metrics = { ok: false, error: err?.message ?? String(err) }
  }

  return NextResponse.json(report, { status: 200 })
}
