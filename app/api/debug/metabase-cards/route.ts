// Debug — lists all Metabase cards with their column names
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY  = process.env.METABASE_API_KEY ?? ''

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = await fetch(`${BASE_URL}/api/card?f=all&page=0&page_size=200`, {
    headers: { 'X-API-KEY': API_KEY },
  })

  const cards = await res.json()

  const list = (cards ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
  }))

  // Filter to cards likely related to users/installs/onboarding
  const relevant = list.filter((c: any) =>
    /user|install|onboard|signup|profile|phone|tal|campaign/i.test(c.name)
  )

  return NextResponse.json({ total: list.length, relevant, all: list })
}
