// Debug endpoint — shows all pilot_installs from DB with qualification breakdown
// Reads from already-synced data — no live API calls
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pilotFilter = req.nextUrl.searchParams.get('pilot')
  const db = getServiceClient()

  const { data: pilots } = await db.from('pilots').select('*').eq('active', true)
  if (!pilots) return NextResponse.json({ error: 'Failed to fetch pilots' }, { status: 500 })

  const reports = []

  for (const pilot of pilots) {
    if (pilotFilter && !pilot.name.toLowerCase().includes(pilotFilter.toLowerCase())) continue

    const { data: installs } = await db
      .from('pilot_installs')
      .select('*')
      .eq('pilot_id', pilot.id)
      .order('is_qualified', { ascending: false })

    const rows = installs ?? []
    const qualified   = rows.filter(r => r.is_qualified)
    const cityFailed  = rows.filter(r => !r.is_city_qualified)
    const compFailed  = rows.filter(r => r.is_city_qualified && !r.is_company_qualified)

    reports.push({
      pilot: pilot.name,
      type:  pilot.type,
      total_onboarded:  rows.length,
      qualified:        qualified.length,
      failed_city:      cityFailed.length,
      failed_company:   compFailed.length,
      installs: rows.map(r => ({
        name:         r.name,
        company:      r.company,
        job_role:     r.job_role,
        city:         r.city,
        city_qual:    r.is_city_qualified,
        company_qual: r.is_company_qualified,
        qualified:    r.is_qualified,
      })),
    })
  }

  const summary = {
    total_onboarded: reports.reduce((s, r) => s + r.total_onboarded, 0),
    total_qualified: reports.reduce((s, r) => s + r.qualified, 0),
    total_failed_city:    reports.reduce((s, r) => s + r.failed_city, 0),
    total_failed_company: reports.reduce((s, r) => s + r.failed_company, 0),
  }

  return NextResponse.json({ generated_at: new Date().toISOString(), summary, pilots: reports })
}
