import { MetricsWithPilot } from '@/lib/db'

type Props = {
  metrics: MetricsWithPilot
}

function pct(n: number) {
  return `${Number(n).toFixed(1)}%`
}

function delta(curr: number, prev: number | undefined): { text: string; up: boolean } | null {
  if (prev === undefined || prev === null) return null
  const d = curr - prev
  if (d === 0) return null
  return { text: d > 0 ? `+${d}` : `${d}`, up: d > 0 }
}

const TYPE_LABEL: Record<string, string> = {
  influencer: 'Influencer',
  ugc:        'UGC',
}

const TYPE_PILL: Record<string, string> = {
  influencer: 'bg-violet-50 text-violet-500',
  ugc:        'bg-sky-50 text-sky-500',
}

export default function PilotCard({ metrics: m }: Props) {
  const typeLabel = TYPE_LABEL[m.pilot.type] ?? m.pilot.type.toUpperCase()
  const typePill  = TYPE_PILL[m.pilot.type]  ?? 'bg-zinc-100 text-zinc-500'

  const qualifiedDelta = delta(m.qualified_installs, m.prev?.qualified_installs)
  const installsDelta  = delta(m.lr_installs,        m.prev?.lr_installs)

  return (
    <div
      className="rounded-2xl p-7 transition-shadow hover:shadow-md"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3
            className="text-[15px] font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
          >
            {m.pilot.name}
          </h3>
          <span
            className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md mt-1.5 tracking-wide ${typePill}`}
            style={{ fontFamily: 'var(--font-inconsolata)' }}
          >
            {typeLabel}
          </span>
        </div>

        {/* Qualified installs - hero number */}
        <div className="text-right">
          <div className="flex items-start justify-end gap-1.5">
            <span
              className="text-4xl font-bold tabular-nums leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              {m.qualified_installs.toLocaleString()}
            </span>
            {qualifiedDelta && (
              <span
                className={`text-xs font-semibold mt-1 tabular-nums ${qualifiedDelta.up ? 'text-emerald-500' : 'text-red-400'}`}
                style={{ fontFamily: 'var(--font-inconsolata)' }}
              >
                {qualifiedDelta.text}
              </span>
            )}
          </div>
          <span
            className="text-[11px] font-medium tracking-wider uppercase mt-1 block"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Qualified
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px mb-6" style={{ background: '#F0EDE8' }} />

      {/* Metrics row: Clicks · Installs */}
      <div className="grid grid-cols-2 gap-6">
        {/* Clicks */}
        <div>
          <div className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {m.lr_clicks > 0 ? m.lr_clicks.toLocaleString() : '—'}
          </div>
          <div
            className="text-[11px] font-medium tracking-wider uppercase mt-0.5"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Clicks
          </div>
        </div>

        {/* Installs */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {m.lr_installs.toLocaleString()}
            </span>
            {installsDelta && (
              <span
                className={`text-xs font-semibold tabular-nums ${installsDelta.up ? 'text-emerald-500' : 'text-red-400'}`}
                style={{ fontFamily: 'var(--font-inconsolata)' }}
              >
                {installsDelta.text}
              </span>
            )}
          </div>
          <div
            className="text-[11px] font-medium tracking-wider uppercase mt-0.5"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Installs
          </div>
        </div>
      </div>

      {/* Funnel bar — only shows after first real sync */}
      {m.lr_installs > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[11px] font-medium tracking-wider uppercase"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              Install → Qualified
            </span>
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-secondary)' }}
            >
              {pct(m.install_to_qualified_rate)}
            </span>
          </div>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: '#EEEBE5' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(m.install_to_qualified_rate, 100)}%`,
                background: '#18181B',
              }}
            />
          </div>
        </div>
      )}

      {/* No-data state */}
      {!m.hasData && (
        <p
          className="text-xs text-center mt-5"
          style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
        >
          No sync yet
        </p>
      )}
    </div>
  )
}
