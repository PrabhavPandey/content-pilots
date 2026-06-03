'use client'

import { useState } from 'react'
import type { CampaignData, CampaignInstall } from '@/lib/db'
import type { CampaignMeta } from '@/lib/campaign-config'
import InstallsChart from './InstallsChart'
import InstallerTable from './InstallerTable'
import type { PilotInstall } from '@/lib/db'
import { formatInr } from '@/lib/pilot-config'

type Props = {
  data: CampaignData
  meta: CampaignMeta
}

function delta(curr: number, prev: number | undefined) {
  if (prev === undefined || prev === null) return null
  const d = curr - prev
  if (d === 0) return null
  return { text: d > 0 ? `+${d}` : `${d}`, up: d > 0 }
}

function MetricCol({ value, label, delta: d }: { value: string; label: string; delta?: { text: string; up: boolean } | null }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-0.5">
        <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-poppins)' }}>
          {value}
        </span>
        {d && (
          <span className={`text-xs font-semibold tabular-nums ${d.up ? 'text-emerald-500' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-inconsolata)' }}>
            {d.text}
          </span>
        )}
      </div>
      <div className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
        {label}
      </div>
    </div>
  )
}

// ── Creator row (no chart) ─────────────────────────────────────────────────────

function CreatorRow({ creator }: { creator: CampaignData['creators'][number] }) {
  const m    = creator.metrics
  const prev = creator.prev

  return (
    <div
      className="grid gap-4 px-4 py-3 rounded-xl"
      style={{
        gridTemplateColumns: '120px repeat(4, 1fr)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Label */}
      <div className="flex items-center">
        <span className="text-[11px] font-semibold tracking-[0.12em]" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-secondary)' }}>
          {creator.label}
        </span>
      </div>

      <div>
        <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-poppins)' }}>
          {m ? m.lr_clicks.toLocaleString() : '—'}
        </div>
        <div className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>Clicks</div>
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-poppins)' }}>
            {m ? m.lr_installs.toLocaleString() : '—'}
          </span>
          {m && prev && (() => { const d = delta(m.lr_installs, prev.lr_installs); return d ? <span className={`text-[10px] font-semibold ${d.up ? 'text-emerald-500' : 'text-red-400'}`}>{d.text}</span> : null })()}
        </div>
        <div className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>Installs</div>
      </div>

      <div>
        <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-poppins)' }}>
          {m ? m.lr_signups.toLocaleString() : '—'}
        </div>
        <div className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>Sign-ups</div>
      </div>

      <div>
        <div className="text-sm font-semibold tabular-nums" style={{ color: m?.qualified_installs ? '#059669' : 'var(--text-primary)', fontFamily: 'var(--font-poppins)' }}>
          {m ? (m.qualified_installs > 0 ? m.qualified_installs.toLocaleString() : '—') : '—'}
        </div>
        <div className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>Qualified</div>
      </div>
    </div>
  )
}

// ── Campaign card ─────────────────────────────────────────────────────────────

export default function CampaignCard({ data, meta }: Props) {
  const [expanded, setExpanded] = useState(false)
  const m    = data.metrics
  const prev = data.prev

  const installsDelta = m && prev ? delta(m.lr_installs, prev.lr_installs) : null
  const qualRate = m && m.lr_installs > 0
    ? `${((m.qualified_installs / m.lr_installs) * 100).toFixed(1)}%`
    : null

  // Shape installs for chart (reuse InstallsChart which takes PilotInstall[]-shaped data)
  const chartInstalls = data.installs as unknown as Parameters<typeof InstallsChart>[0]['installs']

  return (
    <div
      className="rounded-2xl p-7"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight mb-2" style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}>
            {meta.name}
          </h3>
          <div className="flex items-center gap-2">
            <span
              className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide"
              style={{ fontFamily: 'var(--font-inconsolata)', background: '#EFF6FF', color: '#3B82F6' }}
            >
              UGC
            </span>
            <span className="text-[11px]" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
              {meta.creators.length} creators
            </span>
          </div>
        </div>
      </div>

      <div className="h-px mb-6" style={{ background: 'var(--border)' }} />

      {/* Campaign-level metrics */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <MetricCol value={m ? m.lr_clicks.toLocaleString() : '—'} label="Clicks" />
        <MetricCol value={m ? m.lr_installs.toLocaleString() : '—'} label="Installs" delta={installsDelta} />
        <MetricCol value={m ? m.lr_signups.toLocaleString() : '—'} label="Sign-ups" />
        <div>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: m?.qualified_installs ? '#059669' : 'var(--text-primary)', fontFamily: 'var(--font-poppins)' }}>
              {m ? (m.qualified_installs > 0 ? m.qualified_installs.toLocaleString() : '—') : '—'}
            </span>
          </div>
          <div className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
            Qualified {qualRate && <span className="text-emerald-600 ml-1">{qualRate}</span>}
          </div>
        </div>
      </div>

      {/* Chart */}
      {data.installs.length > 0 && (
        <InstallsChart installs={chartInstalls} startDate="2026-06-01" />
      )}

      {!data.hasData && (
        <p className="text-xs text-center mt-4 italic" style={{ color: 'var(--text-muted)' }}>
          No sync yet — run campaign sync to populate data.
        </p>
      )}

      {/* Onboarded users table — same as pilots */}
      <InstallerTable
        installs={data.installs as unknown as PilotInstall[]}
        showPhone
      />

      {/* Creator breakdown toggle */}
      {meta.creators.length > 0 && (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 w-full text-left"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
              Creator breakdown
            </span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {expanded ? '▲' : '▼'}
            </span>
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {/* Header row */}
              <div
                className="grid gap-4 px-4 py-1"
                style={{ gridTemplateColumns: '120px repeat(4, 1fr)' }}
              >
                {['Creator', 'Clicks', 'Installs', 'Sign-ups', 'Qualified'].map(h => (
                  <div key={h} className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Creator rows */}
              {data.creators.length > 0
                ? data.creators
                    .sort((a, b) => (b.metrics?.lr_installs ?? 0) - (a.metrics?.lr_installs ?? 0))
                    .map(creator => <CreatorRow key={creator.slug} creator={creator} />)
                : meta.creators.map(cr => (
                    <CreatorRow key={cr.slug} creator={{ slug: cr.slug, label: cr.label, metrics: null, prev: null }} />
                  ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}
