import { createClient } from '@supabase/supabase-js'

// Server-side client with service role (bypasses RLS - for cron/admin ops)
export function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Public client (for auth checks only)
export function getAnonClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )
}

export type Pilot = {
  id: string
  name: string
  type: 'influencer' | 'ugc'
  linkrunner_campaign_name: string
  active: boolean
}

export type PilotMetrics = {
  id: string
  pilot_id: string
  fetched_at: string
  lr_clicks: number
  lr_installs: number
  lr_reinstalls: number
  lr_signups: number
  lr_conversion_rate: number
  lr_retention_d1: number
  lr_retention_d7: number
  mp_first_app_opens: number
  qualified_installs: number
  click_to_install_rate: number
  install_to_qualified_rate: number
}

export type PilotInstall = {
  id: string
  pilot_id: string
  synced_at: string
  phone: string | null
  name: string | null
  company: string | null
  job_role: string | null
  city: string | null
  linkedin: string | null
  onboarded_at: string | null
  is_city_qualified: boolean
  is_company_qualified: boolean
  is_qualified: boolean
  gemini_reason: string | null
}

export type User = {
  id: string
  username: string
  role: 'admin' | 'pilot'
  pilot_id: string | null
}

export type MetricsWithPilot = PilotMetrics & {
  pilot: Pilot
  // Previous sync row - used to compute deltas on the dashboard
  prev?: PilotMetrics
  // False when no sync has run yet (zeroed placeholder row)
  hasData: boolean
}

// Fetch latest metrics for all pilots (or one pilot).
// Returns the most recent row + the one before it (for delta display).
// When no sync has run, returns zeroed placeholder with hasData: false.
export async function getLatestMetrics(pilotId?: string): Promise<MetricsWithPilot[]> {
  const db = getServiceClient()

  // 'dot' is excluded from the dashboard (inactive pilot)
  const EXCLUDED_SLUGS = ['dot']

  const { data: pilots } = await db
    .from('pilots')
    .select('*')
    .eq('active', true)
    .not('linkrunner_campaign_name', 'in', `(${EXCLUDED_SLUGS.join(',')})`)
    .order('name')

  if (!pilots) return []

  const filteredPilots = pilotId ? pilots.filter(p => p.id === pilotId) : pilots
  const results: MetricsWithPilot[] = []

  for (const pilot of filteredPilots) {
    // Fetch last 2 rows so we can compute deltas
    const { data: rows } = await db
      .from('pilot_metrics')
      .select('*')
      .eq('pilot_id', pilot.id)
      .order('fetched_at', { ascending: false })
      .limit(2)

    const current = rows?.[0]
    const prev = rows?.[1]

    if (current) {
      results.push({ ...current, pilot, prev: prev ?? undefined, hasData: true })
    } else {
      // No sync yet - return zeroed row so the card still renders
      // fetched_at is empty string so SyncBadge doesn't show "just now"
      results.push({
        id: '',
        pilot_id: pilot.id,
        fetched_at: '',
        lr_clicks: 0,
        lr_installs: 0,
        lr_reinstalls: 0,
        lr_signups: 0,
        lr_conversion_rate: 0,
        lr_retention_d1: 0,
        lr_retention_d7: 0,
        mp_first_app_opens: 0,
        qualified_installs: 0,
        click_to_install_rate: 0,
        install_to_qualified_rate: 0,
        pilot,
        hasData: false,
      })
    }
  }

  return results
}

// ── Campaign mode types ───────────────────────────────────────────────────────

export type CampaignMetrics = {
  id: string
  campaign_slug: string
  fetched_at: string
  lr_clicks: number
  lr_installs: number
  lr_signups: number
  mp_first_app_opens: number
  qualified_installs: number
}

export type CreatorMetrics = {
  id: string
  campaign_slug: string
  creator_slug: string
  creator_label: string
  fetched_at: string
  lr_clicks: number
  lr_installs: number
  lr_signups: number
  mp_first_app_opens: number
  qualified_installs: number
}

export type CampaignInstall = {
  id: string
  campaign_slug: string
  creator_slug: string
  creator_label: string
  synced_at: string
  phone: string | null
  name: string | null
  company: string | null
  job_role: string | null
  city: string | null
  linkedin: string | null
  onboarded_at: string | null
  is_city_qualified: boolean
  is_company_qualified: boolean
  is_qualified: boolean
  gemini_reason: string | null
}

export type CreatorData = {
  slug: string
  label: string
  metrics: CreatorMetrics | null
  prev: CreatorMetrics | null
}

export type CampaignData = {
  slug: string
  metrics: CampaignMetrics | null
  prev: CampaignMetrics | null
  creators: CreatorData[]
  installs: CampaignInstall[]
  hasData: boolean
}

// Fetch latest campaign + creator metrics for all campaigns in CAMPAIGN_META
export async function getLatestCampaignData(campaignSlugs: string[]): Promise<CampaignData[]> {
  const db = getServiceClient()
  const results: CampaignData[] = []

  for (const slug of campaignSlugs) {
    // Latest 2 campaign_metrics rows
    const { data: cmRows } = await db
      .from('campaign_metrics')
      .select('*')
      .eq('campaign_slug', slug)
      .order('fetched_at', { ascending: false })
      .limit(2)

    const metrics = cmRows?.[0] ?? null
    const prev    = cmRows?.[1] ?? null

    // Latest 2 creator_metrics rows per creator slug
    const { data: allCreatorRows } = await db
      .from('creator_metrics')
      .select('*')
      .eq('campaign_slug', slug)
      .order('fetched_at', { ascending: false })

    // Group by creator_slug → latest + prev
    const creatorMap = new Map<string, { curr: CreatorMetrics | null; prev: CreatorMetrics | null }>()
    for (const row of (allCreatorRows ?? [])) {
      const entry = creatorMap.get(row.creator_slug)
      if (!entry) {
        creatorMap.set(row.creator_slug, { curr: row, prev: null })
      } else if (!entry.prev) {
        creatorMap.get(row.creator_slug)!.prev = row
      }
    }

    // Installs for chart
    const installs = await getAllCampaignInstalls(slug)

    // Get unique creator slugs from stored rows
    const creatorSlugs = [...new Set((allCreatorRows ?? []).map(r => r.creator_slug))]
    const creators: CreatorData[] = creatorSlugs.map(cs => {
      const entry = creatorMap.get(cs)
      const anyRow = (allCreatorRows ?? []).find(r => r.creator_slug === cs)
      return {
        slug: cs,
        label: anyRow?.creator_label ?? cs,
        metrics: entry?.curr ?? null,
        prev:    entry?.prev ?? null,
      }
    })

    results.push({ slug, metrics, prev, creators, installs, hasData: !!metrics })
  }

  return results
}

// Fetch campaign_installs for a campaign (or all) — paginated
export async function getAllCampaignInstalls(campaignSlug?: string): Promise<CampaignInstall[]> {
  const db = getServiceClient()
  const all: CampaignInstall[] = []
  const PAGE = 1000
  let from = 0

  while (true) {
    let q = db
      .from('campaign_installs')
      .select('*')
      .order('onboarded_at', { ascending: true })
      .range(from, from + PAGE - 1)

    if (campaignSlug) q = q.eq('campaign_slug', campaignSlug)

    const { data, error } = await q
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

// ── Pilot installs (existing) ─────────────────────────────────────────────────

// Fetch onboarded installs. Pass pilotId to scope to one pilot (agency view).
// Returns a map of pilot_id → installs array.
// Paginates in chunks of 1000 to bypass PostgREST default max_rows=1000.
export async function getAllPilotInstalls(pilotId?: string): Promise<Map<string, PilotInstall[]>> {
  const db = getServiceClient()
  const all: PilotInstall[] = []
  const PAGE = 1000
  let from = 0

  while (true) {
    let q = db
      .from('pilot_installs')
      .select('*')
      .order('is_qualified', { ascending: false })
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1)

    if (pilotId) q = q.eq('pilot_id', pilotId)

    const { data, error } = await q
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  const map = new Map<string, PilotInstall[]>()
  for (const row of all) {
    if (!map.has(row.pilot_id)) map.set(row.pilot_id, [])
    map.get(row.pilot_id)!.push(row)
  }
  return map
}
