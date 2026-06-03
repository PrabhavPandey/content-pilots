// Thin wrapper so the client never sees CRON_SECRET.
// Requires an active admin session.
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 })
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  // Fire-and-forget — don't await the full sync so this endpoint returns immediately.
  // The cron route runs independently up to its maxDuration (300s).
  fetch(`${baseUrl}/api/cron/sync?secret=${encodeURIComponent(secret)}`, {
    cache: 'no-store',
  }).catch(() => {}) // intentionally not awaited

  return NextResponse.json({ message: 'Sync started' }, { status: 202 })
}
