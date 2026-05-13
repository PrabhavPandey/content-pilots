// Debug — traces the sync pipeline step by step for one campaign
// GET /api/debug/sync-trace?secret=X&campaign=aarchi

import { NextRequest, NextResponse } from 'next/server'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY  = process.env.METABASE_API_KEY ?? ''

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaign = req.nextUrl.searchParams.get('campaign') ?? 'aarchi'

  // Step 1: Mixpanel
  let mpPhones: string[] = []
  let mpFirstAppOpens = 0
  let mpError: string | null = null
  try {
    const mpMap = await getAllCampaignInstalls([campaign])
    const bucket = mpMap.get(campaign) ?? { first_app_opens: 0, users: [] }
    mpFirstAppOpens = bucket.first_app_opens
    mpPhones = bucket.users.map(u => u.phone)
  } catch (e: any) {
    mpError = e?.message ?? String(e)
  }

  // Step 2: Metabase raw test — tiny query to verify connectivity + permissions
  let metabaseRawTest: any = null
  try {
    const res = await fetch(`${BASE_URL}/api/dataset`, {
      method: 'POST',
      headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: 12,
        type: 'native',
        native: { query: 'SELECT 1 AS ok' },
      }),
      next: { revalidate: 0 },
    })
    const data = await res.json()
    metabaseRawTest = {
      status: res.status,
      rows: data?.data?.rows ?? null,
      error: data?.error ?? null,
    }
  } catch (e: any) {
    metabaseRawTest = { exception: e?.message ?? String(e) }
  }

  // Step 3: getOnboardedUsers with actual phones
  let metaUsers: any[] = []
  let metaError: string | null = null
  if (mpPhones.length > 0) {
    try {
      metaUsers = await getOnboardedUsers(mpPhones.slice(0, 20)) // test with first 20
    } catch (e: any) {
      metaError = e?.message ?? String(e)
    }
  }

  return NextResponse.json({
    campaign,
    step1_mixpanel: {
      error: mpError,
      first_app_opens: mpFirstAppOpens,
      users_with_phone: mpPhones.length,
      sample_phones_last4: mpPhones.slice(0, 10).map(p => p.slice(-4)),
    },
    step2_metabase_connectivity: metabaseRawTest,
    step3_metabase_phone_lookup: {
      error: metaError,
      phones_sent: Math.min(mpPhones.length, 20),
      users_returned: metaUsers.length,
      sample: metaUsers.slice(0, 5).map(u => ({
        phone_last4: u.phone.slice(-4),
        company: u.company,
        onboarded_at: u.onboarded_at,
      })),
    },
  })
}
