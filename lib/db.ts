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

export type User = {
  id: string
  username: string
  role: 'admin' | 'pilot'
  pilot_id: string | null
}

// Fetch latest metrics for all pilots (or one pilot)
export async function getLatestMetrics(pilotId?: string): Promise<(PilotMetrics & { pilot: Pilot })[]> {
  const db = getServiceClient()

  // Get latest fetched_at per pilot using a subquery approach
  const { data: pilots } = await db
    .from('pilots')
    .select('*')
    .eq('active', true)
    .order('name')

  if (!pilots) return []

  const filteredPilots = pilotId ? pilots.filter(p => p.id === pilotId) : pilots
  const results: (PilotMetrics & { pilot: Pilot })[] = []

  for (const pilot of filteredPilots) {
    const { data: metrics } = await db
      .from('pilot_metrics')
      .select('*')
      .eq('pilot_id', pilot.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (metrics) {
      results.push({ ...metrics, pilot })
    } else {
      // Return zeroed metrics if no data yet
      results.push({
        id: '',
        pilot_id: pilot.id,
        fetched_at: new Date().toISOString(),
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
      })
    }
  }

  return results
}
