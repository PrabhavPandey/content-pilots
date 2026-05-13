'use client'

import { MetricsWithPilot, PilotInstall } from '@/lib/db'
import { PILOT_META, formatInr } from '@/lib/pilot-config'

type Props = {
  metrics: MetricsWithPilot[]
  installsMap: Map<string, PilotInstall[]>
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[22px] font-semibold leading-none"
        style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[11px]" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
          {sub}
        </span>
      )}
      <span
        className="text-[9px] font-semibold tracking-[0.15em] uppercase mt-0.5"
        style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
      >
        {label}
      </span>
    </div>
  )
}

export default function CumulativeSummary({ metrics, installsMap }: Props) {
  const totalBudget = metrics.reduce((sum, m) => {
    const meta = PILOT_META[m.pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? '']
    return sum + (meta?.budget ?? 0)
  }, 0)

  const totalClicks    = metrics.reduce((s, m) => s + (m.lr_clicks ?? 0), 0)
  const totalInstalls  = metrics.reduce((s, m) => s + (m.mp_first_app_opens ?? 0), 0)
  const totalQualified = metrics.reduce((s, m) => s + (m.qualified_installs ?? 0), 0)

  const totalOnboarded = [...installsMap.values()].reduce((s, arr) => s + arr.length, 0)

  const costPerQualified = totalQualified > 0 ? Math.round(totalBudget / totalQualified) : null
  const installToQual    = totalInstalls > 0 ? ((totalQualified / totalInstalls) * 100).toFixed(1) : null

  const divider = <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />

  return (
    <div
      className="rounded-2xl px-6 py-5 mb-8"
      style={{ background: '#FAFAF9', border: '1px solid var(--border)' }}
    >
      <p
        className="text-[9px] font-semibold tracking-[0.2em] uppercase mb-4"
        style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
      >
        All Pilots · Combined
      </p>

      <div className="flex items-start gap-6 flex-wrap">
        {totalBudget > 0 && (
          <>
            <Stat label="Total Budget" value={formatInr(totalBudget)} />
            {divider}
          </>
        )}
        <Stat label="Clicks"    value={totalClicks.toLocaleString('en-IN')} />
        {divider}
        <Stat label="Installs"  value={totalInstalls.toLocaleString('en-IN')} />
        {divider}
        <Stat label="Onboarded" value={totalOnboarded.toLocaleString('en-IN')} />
        {divider}
        <Stat label="Qualified" value={totalQualified.toLocaleString('en-IN')} />
        {installToQual && (
          <>
            {divider}
            <Stat label="Install → Qual" value={`${installToQual}%`} />
          </>
        )}
        {costPerQualified && (
          <>
            {divider}
            <Stat label="Cost / Qualified" value={formatInr(costPerQualified)} />
          </>
        )}
      </div>
    </div>
  )
}
