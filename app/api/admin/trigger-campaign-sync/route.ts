import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  fetch(`${baseUrl}/api/cron/campaign-sync?secret=${encodeURIComponent(secret)}`, {
    cache: 'no-store',
  }).catch(() => {})

  return NextResponse.json({ message: 'Campaign sync started' }, { status: 202 })
}
