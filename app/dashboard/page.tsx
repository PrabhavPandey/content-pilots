import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLatestMetrics } from '@/lib/db'
import PilotCard from '@/components/PilotCard'
import SyncBadge from '@/components/SyncBadge'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'admin'
  const pilotId = session.user.pilotId ?? undefined
  const metrics = await getLatestMetrics(isAdmin ? undefined : pilotId)

  // Only show SyncBadge when at least one real sync has occurred
  const latestSync = metrics.find(m => m.fetched_at)?.fetched_at ?? null

  const influencers = metrics.filter(m => m.pilot.type === 'influencer')
  const ugc = metrics.filter(m => m.pilot.type === 'ugc')

  // Dynamic month label - no more hardcoded "May 2025"
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          {!isAdmin && (
            <p className="text-sm text-gray-500 mb-1">Hi there 👋</p>
          )}
          <h1
            className="text-2xl font-semibold text-gray-900"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {isAdmin ? 'Pilots' : metrics[0]?.pilot.name ?? 'Your Campaign'}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isAdmin
              ? `UGC & Influencer · ${monthYear}`
              : `${metrics[0]?.pilot.type === 'influencer' ? 'Influencer' : 'UGC'} · TAL`}
          </p>
          {latestSync && <SyncBadge syncedAt={latestSync} />}
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="py-24 text-center text-gray-400 text-sm">
          No data yet. Trigger a sync to populate metrics.
        </div>
      ) : isAdmin ? (
        <div className="space-y-10">
          <section>
            <p
              className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-4"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              Influencer
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {influencers.map(m => <PilotCard key={m.pilot_id} metrics={m} />)}
            </div>
          </section>
          <section>
            <p
              className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-4"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              UGC
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ugc.map(m => <PilotCard key={m.pilot_id} metrics={m} />)}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map(m => <PilotCard key={m.pilot_id} metrics={m} />)}
        </div>
      )}
    </div>
  )
}
