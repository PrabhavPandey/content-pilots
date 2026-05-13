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

  // Step 3a: raw phone format check — what do phones look like in the DB?
  let phoneFormatCheck: any = null
  try {
    const res = await fetch(`${BASE_URL}/api/dataset`, {
      method: 'POST',
      headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: 12,
        type: 'native',
        native: { query: `SELECT phone::text, created_at FROM tal.users WHERE created_at >= '2026-05-06' LIMIT 5` },
      }),
      next: { revalidate: 0 },
    })
    const data = await res.json()
    phoneFormatCheck = {
      status: res.status,
      rows: data?.data?.rows ?? null,
      error: data?.error ?? null,
    }
  } catch (e: any) {
    phoneFormatCheck = { exception: e?.message ?? String(e) }
  }

  // Step 3b: count of users since May 6
  let recentUserCount: any = null
  try {
    const res = await fetch(`${BASE_URL}/api/dataset`, {
      method: 'POST',
      headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: 12,
        type: 'native',
        native: { query: `SELECT COUNT(*) FROM tal.users WHERE created_at >= '2026-05-06'` },
      }),
      next: { revalidate: 0 },
    })
    const data = await res.json()
    recentUserCount = { status: res.status, rows: data?.data?.rows ?? null, error: data?.error ?? null }
  } catch (e: any) {
    recentUserCount = { exception: e?.message ?? String(e) }
  }

  // Step 3c: try lookup WITHOUT date filter for first 5 phones
  let noDateFilterTest: any = null
  if (mpPhones.length > 0) {
    const phoneList = mpPhones.slice(0, 5).map(p => `'${p}'`).join(', ')
    try {
      const res = await fetch(`${BASE_URL}/api/dataset`, {
        method: 'POST',
        headers: { 'X-API-KEY': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database: 12,
          type: 'native',
          native: { query: `SELECT u.phone::text, u.created_at FROM tal.users u WHERE RIGHT(u.phone::text, 10) IN (${phoneList}) LIMIT 10` },
        }),
        next: { revalidate: 0 },
      })
      const data = await res.json()
      noDateFilterTest = { status: res.status, rows: data?.data?.rows ?? null, error: data?.error ?? null }
    } catch (e: any) {
      noDateFilterTest = { exception: e?.message ?? String(e) }
    }
  }

  // Step 3d: getOnboardedUsers with actual phones
  let metaUsers: any[] = []
  let metaError: string | null = null
  if (mpPhones.length > 0) {
    try {
      metaUsers = await getOnboardedUsers(mpPhones.slice(0, 20))
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
      first_5_phones_full: mpPhones.slice(0, 5),
    },
    step2_metabase_connectivity: metabaseRawTest,
    step3a_db_phone_format: phoneFormatCheck,
    step3b_recent_user_count: recentUserCount,
    step3c_lookup_no_date_filter: noDateFilterTest,
    step3d_full_lookup: {
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
