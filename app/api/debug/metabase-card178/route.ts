import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY  = process.env.METABASE_API_KEY ?? ''

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(`${BASE_URL}/api/card/178/query`, {
    method: 'POST',
    headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ignore_cache: true }),
  })

  const data = await res.json()
  const cols: { name: string }[] = data?.data?.cols ?? []
  const rows: any[][]             = data?.data?.rows ?? []

  const colNames = cols.map(c => c.name)
  const sample   = rows.slice(0, 3).map(row =>
    Object.fromEntries(cols.map((c, i) => [c.name, row[i]]))
  )

  return NextResponse.json({ col_names: colNames, total_rows: rows.length, sample })
}
