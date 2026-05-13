'use client'

import { MetricsWithPilot, PilotInstall } from '@/lib/db'
import { PILOT_META, formatInr } from '@/lib/pilot-config'

type Props = {
  metrics: MetricsWithPilot[]
  installsMap: Map<string, PilotInstall[]>
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[22px] font-semibold leading-none"
        style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
      >
        {value}
      </span>
      <span
        className="text-[9px] font-semibold tracking-[0.15em] uppercase mt-0.5"
        style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
      >
        {label}
      </span>
    </div>
  )
}

function pct(a: number, b: number) {
  if (!b) return null
  return ((a / b) * 100).toFixed(1) + '%'
}

type FunnelStep = { label: string; value: number; color: string }

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = steps[0]?.value || 1

  return (
    <div className="mt-6 space-y-1.5">
      {steps.map((step, i) => {
        const widthPct = Math.max((step.value / max) * 100, 2)
        const conv = i > 0 ? pct(step.value, steps[i - 1].value) : null

        return (
          <div key={step.label} className="flex items-center gap-3">
            {/* label */}
            <div
              className="w-20 text-right text-[10px] font-semibold tracking-[0.08em] uppercase shrink-0"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              {step.label}
            </div>

            {/* bar */}
            <div className="flex-1 relative h-7 flex items-center">
              <div
                className="h-full rounded-md flex items-center px-3 transition-all duration-500"
                style={{ width: `${widthPct}%`, background: step.color, minWidth: 40 }}
              >
                <span
                  className="text-[11px] font-semibold whitespace-nowrap"
                  style={{
                    fontFamily: 'var(--font-inconsolata)',
                    color: i === steps.length - 1 ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {step.value.toLocaleString('en-IN')}
                </span>
              </div>

              {/* conversion drop */}
              {conv && (
                <span
                  className="ml-2.5 text-[10px] font-semibold"
                  style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
                >
                  {conv} from prev
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CumulativeSummary({ metrics, installsMap }: Props) {
  const totalBudget = metrics.reduce((sum, m) => {
    const meta = PILOT_META[m.pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? '']
    return sum + (meta?.budget ?? 0)
  }, 0)

  const totalClicks    = metrics.reduce((s, m) => s + (m.lr_clicks ?? 0), 0)
  const totalInstalls  = metrics.reduce((s, m) => s + (m.lr_installs ?? 0), 0)
  const totalSignups   = metrics.reduce((s, m) => s + (m.lr_signups ?? 0), 0)
  const totalOnboarded = [...installsMap.values()].reduce((s, arr) => s + arr.length, 0)
  const totalQualified = metrics.reduce((s, m) => s + (m.qualified_installs ?? 0), 0)

  const divider = <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />

  const funnelSteps: FunnelStep[] = [
    { label: 'Clicks',    value: totalClicks,    color: '#E7E3DE' },
    { label: 'Installs',  value: totalInstalls,  color: '#D9D3CB' },
    { label: 'Sign-ups',  value: totalSignups,   color: '#C9C0B5' },
    { label: 'Onboarded', value: totalOnboarded, color: '#A89E92' },
    { label: 'Qualified', value: totalQualified, color: '#059669' },
  ]

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

      {/* stat row */}
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
        <Stat label="Sign-ups"  value={totalSignups.toLocaleString('en-IN')} />
        {divider}
        <Stat label="Onboarded" value={totalOnboarded.toLocaleString('en-IN')} />
        {divider}
        <Stat label="Qualified" value={totalQualified.toLocaleString('en-IN')} />
      </div>

      {/* funnel */}
      <Funnel steps={funnelSteps} />
    </div>
  )
}
