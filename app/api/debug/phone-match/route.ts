// Debug — shows raw phone values from Mixpanel vs Metabase to diagnose matching
// Pass ?campaign=aarchi
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaign = req.nextUrl.searchParams.get('campaign') ?? 'aarchi'

  const mpMap = await getAllCampaignInstalls([campaign])
  const mpData = mpMap.get(campaign) ?? { first_app_opens: 0, users: [] }

  const mpPhones = mpData.users.map(u => u.phone)
  const metaUsers = mpPhones.length > 0 ? await getOnboardedUsers(mpPhones) : []

  const metaPhoneSet = new Set(metaUsers.map(u => u.phone))
  const overlap = mpPhones.filter(p => metaPhoneSet.has(p))

  return NextResponse.json({
    campaign,
    mp_users_with_phone: mpPhones.length,
    metabase_matches: metaUsers.length,
    overlap_count: overlap.length,
    overlap_phones_last4: overlap.map(p => p.slice(-4)),
    mp_sample: mpPhones.slice(0, 10).map(p => p.slice(-4)),
    meta_sample: metaUsers.slice(0, 10).map(u => ({ last4: u.phone.slice(-4), company: u.company })),
  })
}
