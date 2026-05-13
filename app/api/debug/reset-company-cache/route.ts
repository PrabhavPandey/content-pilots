// Admin — clears ALL Gemini company classifications so they get re-evaluated on next sync
// POST /api/debug/reset-company-cache?secret=X
// Optional body: { companies: ["teamware solutions", "zophrix private ltd."] } to clear specific ones

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'

export async function POST(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  let body: { companies?: string[] } = {}
  try { body = await req.json() } catch { /* no body = clear all */ }

  if (body.companies && body.companies.length > 0) {
    const keys = body.companies.map(c => c.toLowerCase().trim())
    const { error, count } = await db
      .from('company_classifications')
      .delete({ count: 'exact' })
      .in('company_name', keys)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ deleted: count, companies: keys })
  }

  // Clear all
  const { error, count } = await db
    .from('company_classifications')
    .delete({ count: 'exact' })
    .gt('id', 0)  // delete all rows
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: count, message: 'All company classifications cleared — will re-classify on next sync' })
}
