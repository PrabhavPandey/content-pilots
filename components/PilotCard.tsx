import { PilotMetrics, Pilot } from '@/lib/db'

type Props = {
  metrics: PilotMetrics & { pilot: Pilot }
}

function pct(n: number) {
  return `${Number(n).toFixed(1)}%`
}

const TYPE_LABEL: Record<string, string> = {
  influencer: 'Influencer',
  ugc: 'UGC',
}

const TYPE_PILL: Record<string, string> = {
  influencer: 'bg-violet-50 text-violet-600',
  ugc: 'bg-blue-50 text-blue-600',
}

export default function PilotCard({ metrics: m }: Props) {
  const typeLabel = TYPE_LABEL[m.pilot.type] ?? m.pilot.type.toUpperCase()
  const typePill = TYPE_PILL[m.pilot.type] ?? 'bg-gray-100 text-gray-600'

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
          <div className="text-3xl font-bold text-gray-900 tabular-nums leading-none">
            {m.qualified_installs.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">qualified installs</div>
        </div>
      </div>

      {/* Funnel row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Clicks', value: m.lr_clicks.toLocaleString() },
          { label: 'Installs', value: m.lr_installs.toLocaleString() },
          { label: 'First open', value: m.mp_first_app_opens.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-lg font-semibold text-gray-700 tabular-nums">{value}</div>
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

    </div>
  )
}
