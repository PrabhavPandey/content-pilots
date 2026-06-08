// Campaign sync — graduated campaigns (TDF + Aarchi)
// Each campaign has N creator-level Linkrunner slugs.
// Aggregates metrics at campaign + creator level, stores per-user installs.
//
// Triggered by: Vercel Cron (midnight) or GET /api/cron/campaign-sync?secret=CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getCampaignStatsBySearch, type LinkrunnerCampaignStats } from '@/lib/linkrunner'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'
import { batchClassifyUsers, buildCacheKey } from '@/lib/gemini'
import { CAMPAIGN_META, getAllCreatorSlugs, slugToCampaign } from '@/lib/campaign-config'

const wait = (s: number) => new Promise(r => setTimeout(r, s * 1000))

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

  // ── 1. Mixpanel (single call) + Linkrunner (one search per campaign) ──────
  // Linkrunner's reporting API caps page size at 100 and rate-limits to 1 req/min,
  // and creator slugs can fall on later pages. Instead we use server-side `search`
  // (e.g. search "tdf" → all tdf1…tdf10 in one call). When more than one campaign
  // needs a search, we space the calls 65s apart to respect the rate limit.
  const mpPromise = getAllCampaignInstalls(allCreatorSlugs).catch(() => new Map())

  const lrMap = new Map<string, LinkrunnerCampaignStats>()
  const campaignsWithCreators = Object.entries(CAMPAIGN_META).filter(([, m]) => m.creators.length > 0)
  let firstSearch = true
  for (const [campaignSlug, campaignMeta] of campaignsWithCreators) {
    if (!firstSearch) {
      console.log('[CampaignSync] waiting 65s before next Linkrunner search (rate limit)')
      await wait(65)
    }
    firstSearch = false
    const term = campaignMeta.searchTerm ?? campaignSlug
    const result = await getCampaignStatsBySearch(term)
    for (const [name, stats] of result) lrMap.set(name, stats)
  }

  const mpMap = await mpPromise

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

  console.log(`[CampaignSync] Linkrunner returned ${lrMap.size} creator stats`)

  // ── 5. Per-campaign processing (parallel across campaigns) ────────────────
  const summary: Record<string, any> = {}

  await Promise.all(Object.entries(CAMPAIGN_META).map(async ([campaignSlug, campaignMeta]) => {
    const pilotType = campaignMeta.type
    const creatorRows: any[] = []
    let totalClicks = 0, totalInstalls = 0, totalSignups = 0, totalOpens = 0

    // Fetch previous metrics row to carry forward LR numbers if LR is rate-limited
    const { data: prevRows } = await db
      .from('campaign_metrics')
      .select('lr_clicks, lr_installs, lr_signups')
      .eq('campaign_slug', campaignSlug)
      .order('fetched_at', { ascending: false })
      .limit(1)
    const prevLR = prevRows?.[0]

    // Installs to write for this campaign
    const installRows: any[] = []

    // Did the Linkrunner search return data for this campaign's creators?
    const campaignHasLr = campaignMeta.creators.some(c => lrMap.has(c.slug))

    for (const creator of campaignMeta.creators) {
      const lrStats  = lrMap.get(creator.slug)
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
          city:           null,
          linkedin:       meta.linkedin,
          onboarded_at:   meta.onboarded_at,
          is_city_qualified:    false, // both campaigns are UGC — no city gate
          is_company_qualified: entry?.qualified ?? false,
          is_qualified:         isQualified,
          gemini_reason:        entry?.reason ?? null,
        })
      }

      creatorRows.push({
        campaign_slug:      campaignSlug,
        creator_slug:       creator.slug,
        creator_label:      creator.label,
        fetched_at:         now,
        lr_clicks:          clicks,
        lr_installs:        installs,
        lr_signups:         signups,
        mp_first_app_opens: opens,
        qualified_installs: creatorQualified,
      })
    }

    const campaignQualified = installRows.filter(r => r.is_qualified).length

    // If Linkrunner search returned nothing for this campaign (API outage), carry
    // forward the previous campaign-level LR numbers rather than writing zeros.
    const finalClicks   = campaignHasLr ? totalClicks   : (prevLR?.lr_clicks   ?? 0)
    const finalInstalls = campaignHasLr ? totalInstalls : (prevLR?.lr_installs ?? 0)
    const finalSignups  = campaignHasLr ? totalSignups  : (prevLR?.lr_signups  ?? 0)

    // ── Write campaign_metrics ─────────────────────────────────────────────
    await db.from('campaign_metrics').insert({
      campaign_slug:     campaignSlug,
      fetched_at:        now,
      lr_clicks:         finalClicks,
      lr_installs:       finalInstalls,
      lr_signups:        finalSignups,
      mp_first_app_opens: totalOpens,
      qualified_installs: campaignQualified,
    })

    // ── Write creator_metrics ──────────────────────────────────────────────
    // Skip when the LR search failed so the previous (non-zero) creator rows
    // remain the latest, instead of overwriting the breakdown with zeros.
    if (creatorRows.length > 0 && campaignHasLr) {
      await db.from('creator_metrics').insert(creatorRows)
    }

    // ── Refresh campaign_installs (delete + reinsert) ──────────────────────
    await db.from('campaign_installs').delete().eq('campaign_slug', campaignSlug)
    if (installRows.length > 0) {
      // Insert in 500-row batches, run all batches in parallel
      const batches: any[][] = []
      for (let i = 0; i < installRows.length; i += 500) {
        batches.push(installRows.slice(i, i + 500))
      }
      await Promise.all(batches.map(b => db.from('campaign_installs').insert(b)))
    }

    summary[campaignSlug] = {
      clicks: totalClicks,
      installs: totalInstalls,
      signups: totalSignups,
      qualified: campaignQualified,
      creators: creatorRows.length,
    }

    console.log(`[CampaignSync] ${campaignSlug}: ${totalInstalls} installs, ${campaignQualified} qualified`)
  }))

  return NextResponse.json({ ok: true, synced_at: now, summary })
}
