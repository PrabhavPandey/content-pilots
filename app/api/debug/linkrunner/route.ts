// Debug endpoint - dumps raw Linkrunner API response so we can verify field names + structure
// Protected by CRON_SECRET. Delete this file once the correct endpoint/fields are confirmed.

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://api.linkrunner.io'

async function lr(path: string) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'linkrunner-key': process.env.LINKRUNNER_API_KEY!,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 },
    })
    const body = await res.text()
    return { status: res.status, ok: res.ok, body: safeJson(body) }
  } catch (e: any) {
    return { error: e?.message ?? String(e) }
  }
}

function safeJson(text: string) {
  try { return JSON.parse(text) } catch { return text }
}

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Try all plausible Linkrunner endpoints in parallel
  const [campaigns, dataCampaigns, stats, campaignStats] = await Promise.all([
    lr('/v1/campaigns'),
    lr('/v1/data/campaigns'),
    lr('/v1/stats'),
    lr('/v1/campaign-stats'),
  ])

  return NextResponse.json({
    note: 'Check which endpoint returns clicks/installs. Delete this route once confirmed.',
    '/v1/campaigns': campaigns,
    '/v1/data/campaigns': dataCampaigns,
    '/v1/stats': stats,
    '/v1/campaign-stats': campaignStats,
  })
}
