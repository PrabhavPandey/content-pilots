// This endpoint has been intentionally disabled.
//
// Classification now happens automatically inside /api/cron/sync,
// but ONLY for companies of users who actually clicked a campaign link.
// This prevents classifying thousands of irrelevant Metabase companies with Gemini.
//
// Do not re-enable this without scoping it to campaign-attributed users only.

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Disabled. Classification runs automatically during sync for campaign-attributed users only.' },
    { status: 410 }
  )
}
