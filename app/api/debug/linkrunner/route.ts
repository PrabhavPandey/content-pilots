// CONFIRMED: Linkrunner API endpoint is GET https://api.linkrunner.io/api/v1/campaigns
// CONFIRMED: attributed_users = installs. Clicks are NOT exposed via their API.
// This debug route is no longer needed. Keeping file to avoid Next.js route errors.
// Safe to delete this entire app/api/debug/ folder.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'debug route retired',
    confirmed: {
      endpoint: 'GET https://api.linkrunner.io/api/v1/campaigns',
      installs_field: 'attributed_users',
      clicks: 'NOT available via Linkrunner API',
    }
  })
}
