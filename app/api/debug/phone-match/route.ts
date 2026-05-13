// Debug — shows raw phone values from Mixpanel vs Metabase to diagnose matching
// Pass ?campaign=aarchi
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY  = process.env.METABASE_API_KEY ?? ''
const PILOT_START_DATE = '2026-05-06'

// Raw Metabase fetch (no normalization)
async function getRawMetabasePhones(): Promise<string[]> {
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
  const phoneIdx = cols.findIndex(c => c.name === 'Phone Number')
  if (phoneIdx === -1) return []
  return rows.map(r => String(r[phoneIdx] ?? '')).filter(Boolean)
}

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaign = req.nextUrl.searchParams.get('campaign') ?? 'aarchi'

  const [mpMap, rawMetaPhones] = await Promise.all([
    getAllCampaignInstalls([campaign]),
    getRawMetabasePhones(),
  ])

  const mpData  = mpMap.get(campaign) ?? { first_app_opens: 0, users: [] }

  // Raw Mixpanel phones — fetch directly from JQL without normalization
  // We'll show the normalized forms and the raw forms
  const mpPhonesSample = mpData.users.slice(0, 10).map(u => ({
    raw_from_mixpanel: u.phone, // already normalized by lib — shows post-normalize
  }))

  const metaSample = rawMetaPhones.slice(0, 10).map(raw => ({
    raw_from_metabase: raw,
    normalized: raw.replace(/\D/g, '').slice(-10),
  }))

  // Check overlap using normalized values
  const mpNormalized   = new Set(mpData.users.map(u => u.phone))
  const metaNormalized = new Set(rawMetaPhones.map(r => r.replace(/\D/g, '').slice(-10)))

  const overlap = [...mpNormalized].filter(p => metaNormalized.has(p))

  return NextResponse.json({
    campaign,
    mp_users_with_phone: mpData.users.length,
    metabase_total: rawMetaPhones.length,
    overlap_count: overlap.length,
    overlap_phones_last4: overlap.map(p => p.slice(-4)),
    mp_sample_normalized: mpPhonesSample,
    metabase_sample: metaSample,
  })
}
