import { MetricsWithPilot, PilotInstall } from '@/lib/db'
import { formatInr } from '@/lib/pilot-config'
import CopyLinkBox from './CopyLinkBox'
import InstallsChart from './InstallsChart'

type Props = {
  metrics: MetricsWithPilot
  isAdmin?: boolean
  budget?: number
  videoCount?: number
  views?: number
  linkrunnerUrl?: string
  index?: number
  hideFinancials?: boolean
  installs?: PilotInstall[]
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
  ugc: 'UGC',
}

const TYPE_PILL: Record<string, { bg: string; color: string }> = {
  influencer: { bg: '#F3F0FF', color: '#7C3AED' },
  ugc:        { bg: '#EFF6FF', color: '#3B82F6' },
}

export default function PilotCard({
  metrics: m,
  isAdmin = false,
  budget,
  videoCount,
  views,
  linkrunnerUrl,
  index = 0,
  hideFinancials = false,
  installs,
}: Props) {
  const typeLabel = TYPE_LABEL[m.pilot.type] ?? m.pilot.type.toUpperCase()
  const pill = TYPE_PILL[m.pilot.type] ?? { bg: '#F4F4F5', color: '#71717A' }

  const installsDelta = delta(m.lr_installs, m.prev?.lr_installs)

  const isUgc = m.pilot.type === 'ugc'
  const costPerVideo =
    budget && videoCount && videoCount > 0
      ? Math.round(budget / videoCount)
      : null
  const costPerInstall =
    budget && m.lr_installs > 0
      ? Math.round(budget / m.lr_installs)
      : null
  const cpm =
    budget && views && views > 0
      ? Math.round((budget / views) * 1000)
      : null

  return (
    <div
      className="pilot-card fade-up rounded-2xl p-7"
      style={{
        background: 'var(--bg-card)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        animationDelay: `${index * 55}ms`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3
            className="text-[15px] font-semibold leading-tight mb-2"
            style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
          >
            {m.pilot.name}
          </h3>
          <span
            className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide"
            style={{
              fontFamily: 'var(--font-inconsolata)',
              background: pill.bg,
              color: pill.color,
            }}
          >
            {typeLabel}
          </span>
        </div>

      </div>

      {/* Divider */}
      <div className="h-px mb-6" style={{ background: 'var(--border)' }} />

      {/* Metrics row */}
      <div className={`grid gap-6 ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <div>
          <div
            className="text-2xl font-semibold tabular-nums mb-0.5"
            style={{ color: 'var(--text-primary)' }}
          >
            {m.lr_clicks > 0 ? m.lr_clicks.toLocaleString() : '—'}
          </div>
          <div
            className="text-[10px] font-semibold tracking-[0.18em] uppercase"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Clicks
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span
              className="text-2xl font-semibold tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            >
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
            className="text-[10px] font-semibold tracking-[0.18em] uppercase"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Installs
          </div>
        </div>

        {!isAdmin && (
          <div>
            <div
              className="text-2xl font-semibold tabular-nums mb-0.5"
              style={{ color: 'var(--text-primary)' }}
            >
              {m.qualified_installs > 0 ? m.qualified_installs.toLocaleString() : '—'}
            </div>
            <div
              className="text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
            >
              Qualified
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <div>
              <div
                className="text-2xl font-semibold tabular-nums mb-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {m.lr_signups > 0 ? m.lr_signups.toLocaleString() : '—'}
              </div>
              <div
                className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
              >
                Sign-ups
              </div>
            </div>

            <div>
              <div
                className="text-2xl font-semibold tabular-nums mb-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {m.qualified_installs > 0 ? m.qualified_installs.toLocaleString() : '—'}
              </div>
              <div
                className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
              >
                Qualified
              </div>
            </div>
          </>
        )}
      </div>

      {/* Funnel bar */}
      {m.lr_installs > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[10px] font-semibold tracking-[0.1em] uppercase"
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
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: '#EFECE8' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(m.install_to_qualified_rate, 100)}%`,
                background: '#1A1A1A',
                transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        </div>
      )}

      {/* Admin: views (when available) */}
      {isAdmin && !hideFinancials && views && views > 0 ? (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <span
            className="text-[10px] font-semibold tracking-[0.15em] uppercase block mb-1"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            Views generated
          </span>
          <span
            className="text-[16px] font-semibold"
            style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
          >
            {views.toLocaleString('en-IN')}
          </span>
        </div>
      ) : null}

      {/* Admin: budget + efficiency metrics */}
      {isAdmin && !hideFinancials && (
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span
                className="text-[10px] font-semibold tracking-[0.15em] uppercase block mb-1"
                style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
              >
                Budget
              </span>
              <span
                className="text-[16px] font-semibold"
                style={{
                  fontFamily: 'var(--font-poppins)',
                  color: budget ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {budget ? formatInr(budget) : 'TBD'}
              </span>
            </div>
            {isUgc && costPerVideo && (
              <div className="text-right">
                <span
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase block mb-1"
                  style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
                >
                  Cost / video
                </span>
                <span
                  className="text-[16px] font-semibold"
                  style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
                >
                  {formatInr(costPerVideo)}
                </span>
              </div>
            )}
            {costPerInstall && (
              <div className="text-right">
                <span
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase block mb-1"
                  style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
                >
                  Cost / install
                </span>
                <span
                  className="text-[16px] font-semibold"
                  style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
                >
                  {formatInr(costPerInstall)}
                </span>
              </div>
            )}
            {budget && m.qualified_installs > 0 && (
              <div className="text-right">
                <span
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase block mb-1"
                  style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
                >
                  Cost / qualified
                </span>
                <span
                  className="text-[16px] font-semibold"
                  style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
                >
                  {formatInr(Math.round(budget / m.qualified_installs))}
                </span>
              </div>
            )}
            {cpm && (
              <div className="text-right">
                <span
                  className="text-[10px] font-semibold tracking-[0.15em] uppercase block mb-1"
                  style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
                >
                  CPM
                </span>
                <span
                  className="text-[16px] font-semibold"
                  style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
                >
                  {formatInr(cpm)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin: installs chart */}
      {isAdmin && installs && installs.length > 0 && (
        <InstallsChart installs={installs} />
      )}

      {/* Pilot: tracking link */}
      {!isAdmin && linkrunnerUrl && (
        <CopyLinkBox url={linkrunnerUrl} />
      )}

      {/* No-data state */}
      {!m.hasData && (
        <p
          className="text-xs text-center mt-5 italic"
          style={{ color: 'var(--text-muted)' }}
        >
          No sync yet — data will appear shortly.
        </p>
      )}
    </div>
  )
}
