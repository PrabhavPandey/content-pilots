// Debug — shows raw column names + first 3 rows from Metabase card 498
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY  = process.env.METABASE_API_KEY ?? ''
const PILOT_START_DATE = '2026-05-06'

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  const res = await fetch(`${BASE_URL}/api/card/498/query`, {
    method: 'POST',
    headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ignore_cache: true,
      parameters: [
        { type: 'date/single', value: PILOT_START_DATE, target: ['variable', ['template-tag', 'start_date']] },
        { type: 'date/single', value: today,            target: ['variable', ['template-tag', 'end_date']] },
      ],
    }),
  })

  const data = await res.json()
  const cols: { name: string }[] = data?.data?.cols ?? []
  const rows: any[][]             = data?.data?.rows ?? []

  const colNames = cols.map(c => c.name)
  const sample   = rows.slice(0, 3).map(row =>
    Object.fromEntries(cols.map((c, i) => [c.name, row[i]]))
  )

  return NextResponse.json({ col_names: colNames, sample_rows: sample, total_rows: rows.length })
}
