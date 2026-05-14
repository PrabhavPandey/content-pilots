'use client'

import { useState, useMemo } from 'react'
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
            <div
              className="w-20 text-right text-[10px] font-semibold tracking-[0.08em] uppercase shrink-0"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              {step.label}
            </div>
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

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-[0.1em] uppercase transition-all"
      style={{
        fontFamily: 'var(--font-inconsolata)',
        background: active ? '#111' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        border: `1px solid ${active ? '#111' : 'var(--border)'}`,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default function CumulativeSummary({ metrics, installsMap }: Props) {
  const pilotNames = useMemo(() => metrics.map(m => m.pilot.name), [metrics])

  const [agencies, setAgencies] = useState<string[]>([])
  const [types,    setTypes]    = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const hasFilter = agencies.length > 0 || types.length > 0 || !!dateFrom || !!dateTo

  function toggleAgency(name: string) {
    setAgencies(p => p.includes(name) ? p.filter(x => x !== name) : [...p, name])
  }
  function toggleType(t: string) {
    setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  }
  function clearAll() { setAgencies([]); setTypes([]); setDateFrom(''); setDateTo('') }

  const filtered = useMemo(() =>
    metrics.filter(m => {
      if (agencies.length > 0 && !agencies.includes(m.pilot.name)) return false
      if (types.length > 0    && !types.includes(m.pilot.type))    return false
      return true
    }),
  [metrics, agencies, types])

  const totalBudget   = filtered.reduce((s, m) => {
    const meta = PILOT_META[m.pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? '']
    return s + (meta?.budget ?? 0)
  }, 0)
  const totalClicks   = filtered.reduce((s, m) => s + (m.lr_clicks   ?? 0), 0)
  const totalInstalls = filtered.reduce((s, m) => s + (m.lr_installs ?? 0), 0)
  const totalSignups  = filtered.reduce((s, m) => s + (m.lr_signups  ?? 0), 0)

  const filteredPilotIds = new Set(filtered.map(m => m.pilot_id))

  const { totalOnboarded, totalQualified } = useMemo(() => {
    let onboarded = 0, qualified = 0
    for (const [pilotId, installs] of installsMap.entries()) {
      if (!filteredPilotIds.has(pilotId)) continue
      for (const u of installs) {
        if (dateFrom || dateTo) {
          const d = u.onboarded_at ? new Date(u.onboarded_at) : null
          if (!d) continue
          if (dateFrom && d < new Date(dateFrom)) continue
          if (dateTo   && d > new Date(dateTo + 'T23:59:59')) continue
        }
        onboarded++
        if (u.is_qualified) qualified++
      }
    }
    return { totalOnboarded: onboarded, totalQualified: qualified }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installsMap, filteredPilotIds.size, dateFrom, dateTo])

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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-[9px] font-semibold tracking-[0.2em] uppercase"
          style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
        >
          All Pilots · Combined
        </p>
        {hasFilter && (
          <button
            onClick={clearAll}
            className="text-[10px] font-semibold tracking-[0.08em] uppercase"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Clear ×
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Chip label="UGC"        active={types.includes('ugc')}        onClick={() => toggleType('ugc')} />
        <Chip label="Influencer" active={types.includes('influencer')} onClick={() => toggleType('influencer')} />
        <div className="w-px h-4 self-center" style={{ background: 'var(--border)' }} />
        {pilotNames.map(name => (
          <Chip key={name} label={name} active={agencies.includes(name)} onClick={() => toggleAgency(name)} />
        ))}
        <div className="w-px h-4 self-center" style={{ background: 'var(--border)' }} />
        {(['From', 'To'] as const).map(which => (
          <label key={which} className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-semibold tracking-[0.1em] uppercase"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              {which}
            </span>
            <input
              type="date"
              value={which === 'From' ? dateFrom : dateTo}
              onChange={e => which === 'From' ? setDateFrom(e.target.value) : setDateTo(e.target.value)}
              className="text-[11px] px-2 py-0.5 rounded-md outline-none"
              style={{
                fontFamily: 'var(--font-inconsolata)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
              }}
            />
          </label>
        ))}
      </div>

      {/* Stat row */}
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

      <Funnel steps={funnelSteps} />
    </div>
  )
}
