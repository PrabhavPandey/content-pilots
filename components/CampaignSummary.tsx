'use client'

import { useMemo } from 'react'
import type { CampaignData, CampaignInstall } from '@/lib/db'
import type { CampaignMeta } from '@/lib/campaign-config'
import InstallsChart from './InstallsChart'

type Props = {
  campaigns: { data: CampaignData; meta: CampaignMeta }[]
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="flex flex-col gap-1.5 px-4 py-3 rounded-xl"
      style={{ background: accent ? '#059669' : '#F0EDE8', flex: '1 1 0', minWidth: 90 }}
    >
      <span className="text-[26px] font-semibold leading-none tabular-nums" style={{ fontFamily: 'var(--font-poppins)', color: accent ? '#fff' : 'var(--text-primary)' }}>
        {value}
      </span>
      <span className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: accent ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
        {label}
      </span>
      {sub && (
        <span className="text-[11px] font-semibold" style={{ fontFamily: 'var(--font-inconsolata)', color: accent ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

type FunnelStep = { label: string; value: number; color: string }
function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = steps[0]?.value || 1
  const pct = (a: number, b: number) => b ? ((a / b) * 100).toFixed(1) + '%' : null
  return (
    <div className="mt-6 space-y-2">
      {steps.map((step, i) => {
        const w = Math.max((step.value / max) * 100, 2)
        const conv = i > 0 ? pct(step.value, steps[i - 1].value) : null
        return (
          <div key={step.label} className="flex items-center gap-3">
            <div className="w-[80px] text-right text-[11px] font-semibold tracking-[0.1em] uppercase shrink-0" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
              {step.label}
            </div>
            <div className="flex-1 relative h-7 flex items-center">
              <div className="h-full rounded flex items-center px-3 transition-all duration-500" style={{ width: `${w}%`, background: step.color, minWidth: 40 }}>
                <span className="text-[12px] font-semibold whitespace-nowrap" style={{ fontFamily: 'var(--font-inconsolata)', color: i === steps.length - 1 ? '#fff' : 'var(--text-primary)' }}>
                  {step.value.toLocaleString('en-IN')}
                </span>
              </div>
              {conv && <span className="ml-2 text-[11px]" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>{conv}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CampaignSummary({ campaigns }: Props) {
  const totals = useMemo(() => {
    let clicks = 0, installs = 0, signups = 0, qualified = 0
    for (const { data } of campaigns) {
      const m = data.metrics
      if (!m) continue
      clicks    += m.lr_clicks
      installs  += m.lr_installs
      signups   += m.lr_signups
      qualified += m.qualified_installs
    }
    return { clicks, installs, signups, qualified }
  }, [campaigns])

  // All installs combined for the overall chart
  const allInstalls = useMemo(() =>
    campaigns.flatMap(c => c.data.installs) as unknown as Parameters<typeof InstallsChart>[0]['installs'],
  [campaigns])

  const qualRate = totals.installs > 0
    ? `${((totals.qualified / totals.installs) * 100).toFixed(1)}% of installs`
    : undefined

  const funnelSteps: FunnelStep[] = [
    { label: 'Clicks',   value: totals.clicks,   color: '#E7E3DE' },
    { label: 'Installs', value: totals.installs,  color: '#D9D3CB' },
    { label: 'Sign-ups', value: totals.signups,   color: '#C9C0B5' },
    { label: 'Qualified',value: totals.qualified, color: '#059669' },
  ]

  return (
    <div className="rounded-2xl p-6 mb-8" style={{ background: '#FAFAF9', border: '1px solid var(--border)' }}>
      <p className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-1" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
        All Campaigns · Combined
      </p>
      <p className="text-[11px] mb-5" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
        {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} ·{' '}
        {campaigns.reduce((n, c) => n + c.meta.creators.length, 0)} creators
      </p>

      <div className="mb-5" style={{ height: 1, background: 'var(--border)' }} />

      <div className="flex gap-2 flex-wrap">
        <StatCard label="Clicks"    value={totals.clicks.toLocaleString('en-IN')} />
        <StatCard label="Installs"  value={totals.installs.toLocaleString('en-IN')} />
        <StatCard label="Sign-ups"  value={totals.signups.toLocaleString('en-IN')} />
        <StatCard label="Qualified" value={totals.qualified.toLocaleString('en-IN')} sub={qualRate} accent />
      </div>

      <Funnel steps={funnelSteps} />

      {allInstalls.length > 0 && (
        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
            Overall daily growth
          </p>
          <InstallsChart installs={allInstalls} startDate="2026-06-01" />
        </div>
      )}
    </div>
  )
}
