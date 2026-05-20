'use client'

import { useState, useMemo } from 'react'
import { MetricsWithPilot, PilotInstall } from '@/lib/db'
import { PILOT_META, formatInr } from '@/lib/pilot-config'

type Props = {
  metrics: MetricsWithPilot[]
  installsMap: Map<string, PilotInstall[]>
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value, muted, large }: { label: string; value: string; muted?: boolean; large?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-semibold leading-none tabular-nums"
        style={{
          fontFamily: 'var(--font-poppins)',
          color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
          fontSize: large ? '30px' : '26px',
        }}
      >
        {value}
      </span>
      <span
        className="text-[12px] font-semibold tracking-[0.15em] uppercase"
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
    <div className="mt-7 space-y-2">
      {steps.map((step, i) => {
        const widthPct = Math.max((step.value / max) * 100, 2)
        const conv = i > 0 ? pct(step.value, steps[i - 1].value) : null
        return (
          <div key={step.label} className="flex items-center gap-3">
            <div
              className="w-[80px] text-right text-[11px] font-semibold tracking-[0.1em] uppercase shrink-0"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              {step.label}
            </div>
            <div className="flex-1 relative h-7 flex items-center">
              <div
                className="h-full rounded flex items-center px-3 transition-all duration-500"
                style={{ width: `${widthPct}%`, background: step.color, minWidth: 40 }}
              >
                <span
                  className="text-[12px] font-semibold whitespace-nowrap"
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
                  className="ml-2 text-[11px]"
                  style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
                >
                  {conv}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Toggle chip — minimal, no heavy outline
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase transition-all"
      style={{
        fontFamily: 'var(--font-inconsolata)',
        background: active ? '#1A1A1A' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        border: `1px solid ${active ? '#1A1A1A' : 'var(--border)'}`,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// Clean date input — hides the ugly browser chrome
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-full"
      style={{ border: '1px solid var(--border)', background: 'transparent' }}
    >
      <span
        className="text-[11px] font-semibold tracking-[0.1em] uppercase"
        style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="outline-none bg-transparent text-[12px] font-medium"
        style={{
          fontFamily: 'var(--font-inconsolata)',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          border: 'none',
          width: 90,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-[11px] leading-none"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CumulativeSummary({ metrics, installsMap }: Props) {
  const pilotNames = useMemo(() => metrics.map(m => m.pilot.name), [metrics])

  const [agencies, setAgencies] = useState<string[]>([])
  const [types,    setTypes]    = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const hasFilter = agencies.length > 0 || types.length > 0 || !!dateFrom || !!dateTo

  const toggleAgency = (n: string) => setAgencies(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])
  const toggleType   = (t: string) => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  const clearAll     = () => { setAgencies([]); setTypes([]); setDateFrom(''); setDateTo('') }

  const filtered = useMemo(() =>
    metrics.filter(m => {
      if (agencies.length > 0 && !agencies.includes(m.pilot.name)) return false
      if (types.length > 0    && !types.includes(m.pilot.type))    return false
      return true
    }),
  [metrics, agencies, types])

  const totalBudget   = filtered.reduce((s, m) => s + (PILOT_META[m.pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? '']?.budget ?? 0), 0)
  const totalClicks   = filtered.reduce((s, m) => s + (m.lr_clicks   ?? 0), 0)
  const totalInstalls = filtered.reduce((s, m) => s + (m.lr_installs ?? 0), 0)
  const totalSignups  = filtered.reduce((s, m) => s + (m.lr_signups  ?? 0), 0)
  const totalViews    = filtered.reduce((s, m) => s + (PILOT_META[m.pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? '']?.views ?? 0), 0)

  const filteredIds = new Set(filtered.map(m => m.pilot_id))

  const { totalOnboarded, totalQualified } = useMemo(() => {
    let onboarded = 0, qualified = 0
    for (const [pilotId, installs] of installsMap.entries()) {
      if (!filteredIds.has(pilotId)) continue
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
  }, [installsMap, filteredIds.size, dateFrom, dateTo])

  const funnelSteps: FunnelStep[] = [
    { label: 'Clicks',    value: totalClicks,    color: '#E7E3DE' },
    { label: 'Installs',  value: totalInstalls,  color: '#D9D3CB' },
    { label: 'Sign-ups',  value: totalSignups,   color: '#C9C0B5' },
    { label: 'Onboarded', value: totalOnboarded, color: '#A89E92' },
    { label: 'Qualified', value: totalQualified, color: '#059669' },
  ]

  return (
    <div
      className="rounded-2xl p-6 mb-8"
      style={{ background: '#FAFAF9', border: '1px solid var(--border)' }}
    >
      {/* ── Top bar: label + clear ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <p
          className="text-[11px] font-semibold tracking-[0.22em] uppercase"
          style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
        >
          All Pilots · Combined
        </p>
        {hasFilter && (
          <button
            onClick={clearAll}
            className="text-[12px] font-semibold tracking-[0.06em] uppercase flex items-center gap-1"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear filters <span style={{ fontSize: 13 }}>×</span>
          </button>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="space-y-2.5 mb-6">
        {/* Row 1: type + agency */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[11px] font-semibold tracking-[0.12em] uppercase mr-1 w-14 shrink-0"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Type
          </span>
          <Chip label="UGC"        active={types.includes('ugc')}        onClick={() => toggleType('ugc')} />
          <Chip label="Influencer" active={types.includes('influencer')} onClick={() => toggleType('influencer')} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[11px] font-semibold tracking-[0.12em] uppercase mr-1 w-14 shrink-0"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Agency
          </span>
          {pilotNames.map(name => (
            <Chip key={name} label={name} active={agencies.includes(name)} onClick={() => toggleAgency(name)} />
          ))}
        </div>
        {/* Row 3: date range */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold tracking-[0.12em] uppercase mr-1 w-14 shrink-0"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Date
          </span>
          <DateInput label="From" value={dateFrom} onChange={setDateFrom} />
          <DateInput label="To"   value={dateTo}   onChange={setDateTo} />
        </div>
      </div>

      {/* Divider */}
      <div className="mb-6" style={{ height: 1, background: 'var(--border)' }} />

      {/* ── Budget row (own line) ───────────────────────────────────────── */}
      {totalBudget > 0 && (
        <>
          <div className="flex items-start gap-8 flex-wrap mb-5">
            <Stat label="Budget Spent" value={formatInr(totalBudget)} large />
            {totalViews > 0 && (
              <>
                <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
                <Stat label="Views Generated" value={totalViews.toLocaleString('en-IN')} large />
              </>
            )}
          </div>
          <div className="mb-5" style={{ height: 1, background: 'var(--border)' }} />
        </>
      )}

      {/* ── Funnel metrics row ──────────────────────────────────────────── */}
      <div className="flex items-start gap-8 flex-wrap">
        {totalBudget === 0 && totalViews > 0 && (
          <>
            <Stat label="Views Generated" value={totalViews.toLocaleString('en-IN')} />
            <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
          </>
        )}
        <Stat label="Clicks"    value={totalClicks.toLocaleString('en-IN')} />
        <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
        <Stat label="Installs"  value={totalInstalls.toLocaleString('en-IN')} />
        <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
        <Stat label="Sign-ups"  value={totalSignups.toLocaleString('en-IN')} />
        <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
        <Stat label="Onboarded" value={totalOnboarded.toLocaleString('en-IN')} />
        <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
        <Stat label="Qualified" value={totalQualified.toLocaleString('en-IN')} />
      </div>

      <Funnel steps={funnelSteps} />
    </div>
  )
}
