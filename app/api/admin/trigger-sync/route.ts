import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { waitUntil } from '@vercel/functions'

export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  // waitUntil keeps the function alive until the fetch completes,
  // while still returning the 202 response immediately to the client.
  waitUntil(
    fetch(`${baseUrl}/api/cron/sync?secret=${encodeURIComponent(secret)}`, {
      cache: 'no-store',
    }).catch(() => {})
  )

  return NextResponse.json({ message: 'Sync started' }, { status: 202 })
}
