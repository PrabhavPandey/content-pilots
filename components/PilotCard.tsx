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
  ugc: 'UGC',
}

const TYPE_PILL: Record<string, string> = {
  influencer: 'bg-violet-50 text-violet-600',
  ugc: 'bg-blue-50 text-blue-600',
}

const QUALIFIED_TOOLTIP =
  'Installed TAL via your link → completed onboarding → based in a qualified city (Bangalore, Mumbai, Delhi, Gurgaon, Hyderabad, Pune) → works at a funded startup or tech company'

const INSTALLS_TOOLTIP =
  'App installs directly attributed to your campaign link by Linkrunner'

export default function PilotCard({ metrics: m }: Props) {
  const typeLabel = TYPE_LABEL[m.pilot.type] ?? m.pilot.type.toUpperCase()
  const typePill = TYPE_PILL[m.pilot.type] ?? 'bg-gray-100 text-gray-600'

  const qualifiedDelta = delta(m.qualified_installs, m.prev?.qualified_installs)
  const installsDelta = delta(m.lr_installs, m.prev?.lr_installs)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3
            className="text-base font-semibold text-gray-900 leading-tight"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {m.pilot.name}
          </h3>
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded mt-1.5 ${typePill}`}
            style={{ fontFamily: 'var(--font-inconsolata)' }}
          >
            {typeLabel}
          </span>
        </div>
        <div className="text-right">
          <div className="flex items-start justify-end gap-2">
            <div className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
              {m.qualified_installs.toLocaleString()}
            </div>
            {qualifiedDelta && (
              <span
                className={`text-xs font-semibold mt-1 tabular-nums ${qualifiedDelta.up ? 'text-green-500' : 'text-red-400'}`}
                style={{ fontFamily: 'var(--font-inconsolata)' }}
              >
                {qualifiedDelta.text}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-xs text-gray-400">qualified installs</span>
            <span
              className="text-xs text-gray-300 cursor-help leading-none"
              title={QUALIFIED_TOOLTIP}
            >
              ⓘ
            </span>
          </div>
        </div>
      </div>

      {/* Two core metrics: Installs → Qualified */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Installs */}
        <div>
          <div className="flex items-baseline gap-1">
            <div className="text-2xl font-semibold text-gray-700 tabular-nums">
              {m.lr_installs.toLocaleString()}
            </div>
            {installsDelta && (
              <span
                className={`text-xs font-semibold tabular-nums ${installsDelta.up ? 'text-green-500' : 'text-red-400'}`}
                style={{ fontFamily: 'var(--font-inconsolata)' }}
              >
                {installsDelta.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="text-xs text-gray-400"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              Installs
            </span>
            <span className="text-xs text-gray-300 cursor-help leading-none" title={INSTALLS_TOOLTIP}>ⓘ</span>
          </div>
        </div>

        {/* Signups */}
        <div>
          <div className="flex items-baseline gap-1">
            <div className="text-2xl font-semibold text-gray-700 tabular-nums">
              {m.lr_signups.toLocaleString()}
            </div>
          </div>
          <div
            className="text-xs text-gray-400 mt-0.5"
            style={{ fontFamily: 'var(--font-inconsolata)' }}
          >
            Signups
          </div>
        </div>
      </div>

      {/* Funnel bar: visual install → qualified */}
      {m.lr_installs > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Install → Qualified</span>
            <span
              className="text-xs font-semibold text-gray-600 tabular-nums"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              {pct(m.install_to_qualified_rate)}
            </span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-400 rounded-full transition-all"
              style={{ width: `${Math.min(m.install_to_qualified_rate, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Retention row — only show if we have data */}
      {(m.lr_retention_d1 > 0 || m.lr_retention_d7 > 0) && (
        <div className="border-t border-gray-100 pt-4 flex gap-6">
          <div>
            <div
              className="text-xs font-semibold text-gray-600 tabular-nums"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              {pct(m.lr_retention_d1)}
            </div>
            <div className="text-xs text-gray-400">D1 retention</div>
          </div>
          <div>
            <div
              className="text-xs font-semibold text-gray-600 tabular-nums"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              {pct(m.lr_retention_d7)}
            </div>
            <div className="text-xs text-gray-400">D7 retention</div>
          </div>
        </div>
      )}

      {/* No-data state */}
      {!m.hasData && (
        <p className="text-xs text-gray-300 text-center mt-4">No sync data yet</p>
      )}

    </div>
  )
}
