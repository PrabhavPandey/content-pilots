// Debug endpoint — show all companies Gemini has classified so far
// Also queries Metabase for company breakdown of recent onboards (pilot period)
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'

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

  return NextResponse.json({
    gemini_cache: {
      total_classified: (classifications ?? []).length,
      qualified: qualified.map(c => c.company_name),
      rejected:  rejected.map(c => c.company_name),
    },
  })
}
