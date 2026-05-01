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

  // Admin sees all pilots, agency sees only their own
  const metrics = await getLatestMetrics(isAdmin ? undefined : pilotId)

  const latestSync = metrics[0]?.fetched_at ?? null

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {isAdmin ? 'All Pilots' : metrics[0]?.pilot.name ?? 'Your Campaign'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin
              ? 'UGC & Influencer Marketing Pilots - TAL'
              : `${metrics[0]?.pilot.type === 'influencer' ? 'Influencer' : 'UGC'} pilot`}
          </p>
        </div>
        {latestSync && <SyncBadge syncedAt={latestSync} />}
      </div>

      {/* Pilot cards grid */}
      {metrics.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No data yet. The cron job will sync every 12 hours.
        </div>
      ) : isAdmin ? (
        <>
          {/* Admin: split by type */}
          <section className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              Influencer Pilots
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics
                .filter(m => m.pilot.type === 'influencer')
                .map(m => <PilotCard key={m.pilot_id} metrics={m} isAdmin={isAdmin} />)}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              UGC Pilots
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics
                .filter(m => m.pilot.type === 'ugc')
                .map(m => <PilotCard key={m.pilot_id} metrics={m} isAdmin={isAdmin} />)}
            </div>
          </section>
        </>
      ) : (
        // Agency view: single expanded card
        <div className="grid grid-cols-1 gap-4">
          {metrics.map(m => <PilotCard key={m.pilot_id} metrics={m} isAdmin={false} expanded />)}
        </div>
      )}
    </div>
  )
}
