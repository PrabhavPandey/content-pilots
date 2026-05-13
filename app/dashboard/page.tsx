import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLatestMetrics, getAllPilotInstalls } from '@/lib/db'
import { getPilotMeta } from '@/lib/pilot-config'
import PilotCard from '@/components/PilotCard'
import InstallerTable from '@/components/InstallerTable'
import SyncBadge from '@/components/SyncBadge'
import QualificationCarousel from '@/components/QualificationCarousel'
import CumulativeSummary from '@/components/CumulativeSummary'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'admin'
  const pilotId = session.user.pilotId ?? undefined
  const metrics = await getLatestMetrics(isAdmin ? undefined : pilotId)

  // Admin-only: fetch onboarded installer records
  const installsMap = isAdmin ? await getAllPilotInstalls() : new Map()

  const latestSync = metrics.find(m => m.fetched_at)?.fetched_at ?? null
  const influencers = metrics.filter(m => m.pilot.type === 'influencer')
  const ugc         = metrics.filter(m => m.pilot.type === 'ugc')
  const monthYear   = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="fade-up">
      {/* Page header */}
      <div className="mb-10">
        {!isAdmin && (
          <p
            className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-2"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Your Campaign
          </p>
        )}
        <h1
          className="text-[26px] font-semibold leading-tight"
          style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
        >
          {isAdmin ? 'Pilots' : (metrics[0]?.pilot.name ?? 'Dashboard')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {isAdmin
            ? `UGC & Influencer · ${monthYear}`
            : `${metrics[0]?.pilot.type === 'influencer' ? 'Influencer' : 'UGC'} · TAL`}
        </p>
        {latestSync && <SyncBadge syncedAt={latestSync} />}
      </div>

      {metrics.length === 0 ? (
        <div className="py-24 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No data yet — trigger a sync to populate metrics.
        </div>
      ) : isAdmin ? (
        <div className="space-y-10">
          <CumulativeSummary metrics={metrics} installsMap={installsMap} />
          {influencers.length > 0 && (
            <section>
              <p
                className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
                style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
              >
                Influencer
              </p>
              <div className="flex flex-col gap-4">
                {influencers.map((m, i) => {
                  const meta = getPilotMeta(m.pilot.linkrunner_campaign_name)
                  return (
                    <div key={m.pilot_id}>
                      <PilotCard metrics={m} isAdmin budget={meta?.budget} index={i} />
                      <InstallerTable installs={installsMap.get(m.pilot_id) ?? []} />
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          {ugc.length > 0 && (
            <section>
              <p
                className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
                style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
              >
                UGC
              </p>
              <div className="flex flex-col gap-4">
                {ugc.map((m, i) => {
                  const meta = getPilotMeta(m.pilot.linkrunner_campaign_name)
                  return (
                    <div key={m.pilot_id}>
                      <PilotCard metrics={m} isAdmin budget={meta?.budget} index={i} />
                      <InstallerTable installs={installsMap.get(m.pilot_id) ?? []} />
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div>
          <QualificationCarousel />
          <div className="space-y-4">
            {metrics.map((m, i) => {
              const meta = getPilotMeta(m.pilot.linkrunner_campaign_name)
              return (
                <PilotCard
                  key={m.pilot_id}
                  metrics={m}
                  isAdmin={false}
                  linkrunnerUrl={meta?.linkrunnerUrl}
                  index={i}
                />
              )
            })}
          </div>
          <p
            className="text-center text-sm mt-16 mb-2 italic"
            style={{ fontFamily: 'var(--font-playfair)', color: 'var(--text-muted)' }}
          >
            make magic · one reel at a time
          </p>
        </div>
      )}
    </div>
  )
}
