// Helper endpoint: lists all Metabase questions so you can find the qualified installs question ID
// Hit this once after deploy: GET /api/metabase-questions?secret=CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { listMetabaseQuestions } from '@/lib/metabase'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const questions = await listMetabaseQuestions()
  return NextResponse.json(questions)
}
