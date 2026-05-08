// Debug endpoint — show all companies Gemini has classified so far
// Also queries Metabase for company breakdown of recent onboards (pilot period)
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getOnboardedUsers } from '@/lib/metabase'

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  // All Gemini-classified companies
  const { data: classifications } = await db
    .from('company_classifications')
    .select('company_name, is_startup, classified_at')
    .order('classified_at', { ascending: false })

  const qualified = (classifications ?? []).filter(c => c.is_startup)
  const rejected  = (classifications ?? []).filter(c => !c.is_startup)

  // Metabase: company breakdown of pilot-period onboards (since May 6)
  const metabaseUsers = await getOnboardedUsers()
  const companyCounts = new Map<string, number>()
  for (const u of metabaseUsers) {
    if (!u.company) continue
    const key = u.company.trim()
    companyCounts.set(key, (companyCounts.get(key) ?? 0) + 1)
  }
  const metabaseCompanies = [...companyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([company, count]) => ({ company, count }))

  return NextResponse.json({
    gemini_cache: {
      total_classified: (classifications ?? []).length,
      qualified: qualified.map(c => c.company_name),
      rejected:  rejected.map(c => c.company_name),
    },
    metabase_onboards_since_may6: {
      total_users: metabaseUsers.length,
      users_with_company: metabaseUsers.filter(u => u.company).length,
      companies: metabaseCompanies,
    },
  })
}
