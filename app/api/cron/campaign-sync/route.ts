// Campaign sync — graduated campaigns (TDF + Aarchi)
// Each campaign has N creator-level Linkrunner slugs.
// Aggregates metrics at campaign + creator level, stores per-user installs.
//
// Triggered by: Vercel Cron (midnight) or GET /api/cron/campaign-sync?secret=CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getAllCampaignStats } from '@/lib/linkrunner'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'
import { batchClassifyUsers, buildCacheKey } from '@/lib/gemini'
import { CAMPAIGN_META, getAllCreatorSlugs, slugToCampaign } from '@/lib/campaign-config'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const now = new Date().toISOString()
  const campaignSlugs = Object.keys(CAMPAIGN_META)
  const allCreatorSlugs = getAllCreatorSlugs()
  const creatorToCampaign = slugToCampaign()

  if (allCreatorSlugs.length === 0) {
    return NextResponse.json({ message: 'No creator slugs configured yet' })
  }

  console.log(`[CampaignSync] Starting sync for campaigns: ${campaignSlugs.join(', ')}`)
  console.log(`[CampaignSync] ${allCreatorSlugs.length} creator slugs total`)

  // ── 1. Parallel: Linkrunner + Mixpanel ───────────────────────────────────
  const [lrMap, mpMap] = await Promise.allSettled([
    getAllCampaignStats(),
    getAllCampaignInstalls(allCreatorSlugs),
  ]).then(([lr, mp]) => [
    lr.status === 'fulfilled' ? lr.value : new Map(),
    mp.status === 'fulfilled' ? mp.value : new Map(),
  ] as const)

  // ── 2. Collect all phones across all creators ─────────────────────────────
  const allPhones = new Set<string>()
  for (const slug of allCreatorSlugs) {
    const bucket = (mpMap as Map<string, any>).get(slug)
    bucket?.users?.forEach((u: any) => { if (u.phone) allPhones.add(u.phone) })
  }

  console.log(`[CampaignSync] ${allPhones.size} unique attributed phones`)

  // ── 3. Metabase lookup ────────────────────────────────────────────────────
  const metabaseUsers = allPhones.size > 0
    ? await getOnboardedUsers([...allPhones]).catch(() => [])
    : []

  const phoneToMeta = new Map(metabaseUsers.map(u => [u.phone, u]))

  // ── 4. Gemini classification (all campaigns share ugc type here) ──────────
  // Group by pilot type in case aarchi or future campaigns differ
  const classifyQueue = metabaseUsers.map(u => ({
    company: u.company ?? '',
    jobRole: u.job_role,
  }))

  // For now both TDF and Aarchi are UGC — classify once
  const classMap = classifyQueue.length > 0
    ? await batchClassifyUsers(classifyQueue, 'ugc').catch(() => new Map())
    : new Map()

  // ── 5. Per-campaign processing ────────────────────────────────────────────
  const summary: Record<string, any> = {}

  for (const [campaignSlug, campaignMeta] of Object.entries(CAMPAIGN_META)) {
    const pilotType = campaignMeta.type
    const creatorRows: any[] = []
    let totalClicks = 0, totalInstalls = 0, totalSignups = 0, totalOpens = 0

    // Installs to write for this campaign
    const installRows: any[] = []

    for (const creator of campaignMeta.creators) {
      const lrStats = (lrMap as Map<string, any>).get(creator.slug)
      const mpBucket = (mpMap as Map<string, any>).get(creator.slug)

      const clicks   = lrStats?.clicks   ?? 0
      const installs = lrStats?.installs ?? 0
      const signups  = lrStats?.signups  ?? 0
      const opens    = mpBucket?.first_app_opens ?? 0

      totalClicks   += clicks
      totalInstalls += installs
      totalSignups  += signups
      totalOpens    += opens

      // Per-creator qualified installs
      let creatorQualified = 0
      const creatorPhones: string[] = (mpBucket?.users ?? [])
        .map((u: any) => u.phone)
        .filter(Boolean)

      for (const phone of creatorPhones) {
        const meta = phoneToMeta.get(phone)
        if (!meta) continue

        const companyKey = meta.company?.toLowerCase().trim() ?? ''
        const cacheKey   = buildCacheKey(companyKey, meta.job_role, pilotType)
        const entry      = companyKey ? classMap.get(cacheKey) : undefined
        const isQualified = entry?.qualified ?? false

        if (isQualified) creatorQualified++

        installRows.push({
          campaign_slug:  campaignSlug,
          creator_slug:   creator.slug,
          creator_label:  creator.label,
          synced_at:      now,
          phone:          phone,
          name:           meta.name,
          company:        meta.company,
          job_role:       meta.job_role,
          city:           meta.city,
          linkedin:       meta.linkedin,
          onboarded_at:   meta.onboarded_at,
          is_city_qualified:    false, // both campaigns are UGC — no city gate
          is_company_qualified: entry?.qualified ?? false,
          is_qualified:         isQualified,
          gemini_reason:        entry?.reason ?? null,
        })
      }

      creatorRows.push({
        campaign_slug:     campaignSlug,
        creator_slug:      creator.slug,
        creator_label:     creator.label,
        fetched_at:        now,
        lr_clicks:         clicks,
        lr_installs:       installs,
        lr_signups:        signups,
        mp_first_app_opens: opens,
        qualified_installs: creatorQualified,
      })
    }

    const campaignQualified = installRows.filter(r => r.is_qualified).length

    // ── Write campaign_metrics ─────────────────────────────────────────────
    await db.from('campaign_metrics').insert({
      campaign_slug:     campaignSlug,
      fetched_at:        now,
      lr_clicks:         totalClicks,
      lr_installs:       totalInstalls,
      lr_signups:        totalSignups,
      mp_first_app_opens: totalOpens,
      qualified_installs: campaignQualified,
    })

    // ── Write creator_metrics ──────────────────────────────────────────────
    if (creatorRows.length > 0) {
      await db.from('creator_metrics').insert(creatorRows)
    }

    // ── Refresh campaign_installs (delete + reinsert) ──────────────────────
    await db.from('campaign_installs').delete().eq('campaign_slug', campaignSlug)
    if (installRows.length > 0) {
      // Insert in batches of 500
      for (let i = 0; i < installRows.length; i += 500) {
        await db.from('campaign_installs').insert(installRows.slice(i, i + 500))
      }
    }

    summary[campaignSlug] = {
      clicks: totalClicks,
      installs: totalInstalls,
      signups: totalSignups,
      qualified: campaignQualified,
      creators: creatorRows.length,
    }

    console.log(`[CampaignSync] ${campaignSlug}: ${totalInstalls} installs, ${campaignQualified} qualified`)
  }

  return NextResponse.json({ ok: true, synced_at: now, summary })
}
