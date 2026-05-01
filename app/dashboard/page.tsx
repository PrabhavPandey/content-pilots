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
  const latestSync = metrics[0]?.fetched_at ?? null

  const influencers = metrics.filter(m => m.pilot.type === 'influencer')
  const ugc = metrics.filter(m => m.pilot.type === 'ugc')

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {isAdmin ? 'Pilots' : metrics[0]?.pilot.name ?? 'Campaign'}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {isAdmin ? 'May 2025 · UGC & Influencer' : `${metrics[0]?.pilot.type === 'influencer' ? 'Influencer' : 'UGC'} · TAL`}
          </p>
        </div>
        {latestSync && <SyncBadge syncedAt={latestSync} />}
      </div>

      {metrics.length === 0 ? (
        <div className="py-24 text-center text-zinc-600 text-sm">
          No data yet - trigger a sync to populate metrics.
        </div>
      ) : isAdmin ? (
        <div className="space-y-10">
          <section>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-4">Influencer</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {influencers.map(m => <PilotCard key={m.pilot_id} metrics={m} isAdmin />)}
            </div>
          </section>
          <section>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-4">UGC</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ugc.map(m => <PilotCard key={m.pilot_id} metrics={m} isAdmin />)}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map(m => <PilotCard key={m.pilot_id} metrics={m} isAdmin={false} expanded />)}
        </div>
      )}
    </div>
  )
}
