import { MetricsWithPilot } from '@/lib/db'

type Props = {
  metrics: MetricsWithPilot
}

function pct(n: number) {
  return `${Number(n).toFixed(1)}%`
}

// Returns delta info if there's a meaningful change since last sync
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
  'Clicked your link → installed TAL → completed onboarding → in a qualified city (Bangalore, Mumbai, Delhi, Gurgaon, Hyderabad, Pune) → works at a funded startup or tech company'

export default function PilotCard({ metrics: m }: Props) {
  const typeLabel = TYPE_LABEL[m.pilot.type] ?? m.pilot.type.toUpperCase()
  const typePill = TYPE_PILL[m.pilot.type] ?? 'bg-gray-100 text-gray-600'

  const qualifiedDelta = delta(m.qualified_installs, m.prev?.qualified_installs)
  const clicksDelta = delta(m.lr_clicks, m.prev?.lr_clicks)
  const installsDelta = delta(m.lr_installs, m.prev?.lr_installs)
  const opensDelta = delta(m.mp_first_app_opens, m.prev?.mp_first_app_opens)

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

      {/* Funnel row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Clicks', value: m.lr_clicks.toLocaleString(), d: clicksDelta },
          { label: 'Installs', value: m.lr_installs.toLocaleString(), d: installsDelta },
          { label: 'First open', value: m.mp_first_app_opens.toLocaleString(), d: opensDelta },
        ].map(({ label, value, d: dd }) => (
          <div key={label}>
            <div className="flex items-baseline gap-1">
              <div className="text-lg font-semibold text-gray-700 tabular-nums">{value}</div>
              {dd && (
                <span
                  className={`text-xs font-semibold tabular-nums ${dd.up ? 'text-green-500' : 'text-red-400'}`}
                  style={{ fontFamily: 'var(--font-inconsolata)' }}
                >
                  {dd.text}
                </span>
              )}
            </div>
            <div
              className="text-xs text-gray-400 mt-0.5"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Rates */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        {[
          { label: 'Click → Install', value: pct(m.click_to_install_rate) },
          { label: 'Install → Qualified', value: pct(m.install_to_qualified_rate) },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{label}</span>
            <span
              className="text-xs font-semibold text-gray-700 tabular-nums"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* No-data state */}
      {!m.hasData && (
        <p className="text-xs text-gray-300 text-center mt-4">No sync data yet</p>
      )}

    </div>
  )
}
