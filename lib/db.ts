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

  const { data: pilots } = await db
    .from('pilots')
    .select('*')
    .eq('active', true)
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

// Fetch all onboarded installs across all pilots (admin only).
// Returns a map of pilot_id → installs array.
export async function getAllPilotInstalls(): Promise<Map<string, PilotInstall[]>> {
  const db = getServiceClient()
  const { data } = await db
    .from('pilot_installs')
    .select('*')
    .order('is_qualified', { ascending: false })
    .order('name', { ascending: true })

  const map = new Map<string, PilotInstall[]>()
  for (const row of data ?? []) {
    if (!map.has(row.pilot_id)) map.set(row.pilot_id, [])
    map.get(row.pilot_id)!.push(row)
  }
  return map
}
