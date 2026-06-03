import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLatestMetrics, getAllPilotInstalls, getLatestCampaignData } from '@/lib/db'
import { getPilotMeta } from '@/lib/pilot-config'
import { CAMPAIGN_META } from '@/lib/campaign-config'
import PilotCard from '@/components/PilotCard'
import InstallerTable from '@/components/InstallerTable'
import SyncBadge from '@/components/SyncBadge'
import DashboardAdminView from '@/components/DashboardAdminView'
import RunSyncButton from '@/components/RunSyncButton'
import CampaignCard from '@/components/CampaignCard'
import CampaignSummary from '@/components/CampaignSummary'
import ModeSwitcher from '@/components/ModeSwitcher'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin  = session.user.role === 'admin'
  const pilotId  = session.user.pilotId ?? undefined
  const params   = await searchParams
  const mode     = isAdmin && params.mode === 'campaign' ? 'campaign' : 'pilots'

  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // ── Campaign mode (admin only) ────────────────────────────────────────────
  if (mode === 'campaign') {
    const campaignSlugs = Object.keys(CAMPAIGN_META)
    const campaignData  = await getLatestCampaignData(campaignSlugs)

    const campaigns = campaignSlugs.map((slug, i) => ({
      data: campaignData[i],
      meta: CAMPAIGN_META[slug],
    }))

    const latestCampaignSync = campaignData
      .map(d => d.metrics?.fetched_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

    return (
      <div className="fade-up">
        <div className="mb-10">
          <h1 className="text-[26px] font-semibold leading-tight" style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}>
            Campaigns
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            UGC · {monthYear}
          </p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <ModeSwitcher mode="campaign" />
            {latestCampaignSync && <SyncBadge syncedAt={latestCampaignSync} />}
            <RunSyncButton campaignMode />
          </div>
        </div>

        <CampaignSummary campaigns={campaigns} />

        <div className="space-y-8">
          {campaigns.map(({ data, meta }) => (
            <CampaignCard key={data.slug} data={data} meta={meta} />
          ))}
        </div>
      </div>
    )
  }

  // ── Pilots mode (default) ─────────────────────────────────────────────────
  const metrics     = await getLatestMetrics(isAdmin ? undefined : pilotId)
  const installsMap = isAdmin
    ? await getAllPilotInstalls()
    : pilotId
      ? await getAllPilotInstalls(pilotId)
      : new Map()

  const latestSync = metrics.find(m => m.fetched_at)?.fetched_at ?? null

  return (
    <div className="fade-up">
      <div className="mb-10">
        {!isAdmin && (
          <p className="text-[10px] font-semibold tracking-[0.22em] uppercase mb-2" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
            Your Campaign
          </p>
        )}
        <h1 className="text-[26px] font-semibold leading-tight" style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}>
          {isAdmin ? 'Pilots' : (metrics[0]?.pilot.name ?? 'Dashboard')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {isAdmin
            ? `UGC & Influencer · ${monthYear}`
            : `${metrics[0]?.pilot.type === 'influencer' ? 'Influencer' : 'UGC'} · TAL`}
        </p>
        <div className="flex items-center gap-3 mt-2">
          {latestSync && <SyncBadge syncedAt={latestSync} />}
          {isAdmin && <RunSyncButton />}
          {isAdmin && (
            <a
              href="/dashboard?mode=campaign"
              className="text-[11px] font-semibold tracking-[0.08em] uppercase px-3 py-1 rounded-md"
              style={{ fontFamily: 'var(--font-inconsolata)', background: '#1A1A1A', color: '#fff', textDecoration: 'none' }}
            >
              Campaigns →
            </a>
          )}
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="py-24 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No data yet — trigger a sync to populate metrics.
        </div>
      ) : isAdmin ? (
        <DashboardAdminView metrics={metrics} installsMap={installsMap} />
      ) : (
        <div>
          <div className="space-y-4">
            {metrics.map((m, i) => {
              const meta = getPilotMeta(m.pilot.linkrunner_campaign_name)
              return (
                <div key={m.pilot_id}>
                  <PilotCard metrics={m} isAdmin={false} linkrunnerUrl={meta?.linkrunnerUrl} index={i} />
                  <InstallerTable installs={installsMap.get(m.pilot_id) ?? []} showPhone={false} />
                </div>
              )
            })}
          </div>
          <p className="text-center text-sm mt-16 mb-2 italic" style={{ fontFamily: 'var(--font-playfair)', color: 'var(--text-muted)' }}>
            make magic · one reel at a time
          </p>
        </div>
      )}
    </div>
  )
}
