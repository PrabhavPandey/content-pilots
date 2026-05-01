import { PilotMetrics, Pilot } from '@/lib/db'
import MetricTile from './MetricTile'

type Props = {
  metrics: PilotMetrics & { pilot: Pilot }
  isAdmin: boolean
  expanded?: boolean
}

const TYPE_COLORS = {
  influencer: 'text-violet-400 bg-violet-400/10',
  ugc: 'text-emerald-400 bg-emerald-400/10',
}

function pct(n: number) {
  return `${Number(n).toFixed(1)}%`
}

export default function PilotCard({ metrics: m, isAdmin, expanded = false }: Props) {
  const typeColor = TYPE_COLORS[m.pilot.type]

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-6 ${expanded ? '' : ''}`}>
      {/* Pilot header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-semibold text-white text-lg leading-tight">{m.pilot.name}</h3>
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1.5 ${typeColor}`}>
            {m.pilot.type === 'influencer' ? 'Influencer' : 'UGC'}
          </span>
        </div>
        {/* Qualified installs - the headline number */}
        <div className="text-right">
          <div className="text-3xl font-bold text-white tabular-nums">
            {m.qualified_installs.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">qualified installs</div>
        </div>
      </div>

      {/* Funnel: Clicks → Installs → Qualified */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MetricTile label="Clicks" value={m.lr_clicks.toLocaleString()} />
        <MetricTile label="Installs" value={m.lr_installs.toLocaleString()} />
        <MetricTile label="First App Open" value={m.mp_first_app_opens.toLocaleString()} note="Mixpanel" />
      </div>

      {/* Rates row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricTile label="Click → Install" value={pct(m.click_to_install_rate)} />
        <MetricTile label="Install → Qualified" value={pct(m.install_to_qualified_rate)} highlight />
      </div>

      {/* Retention (expanded or admin sees these) */}
      {(expanded || isAdmin) && (
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-800">
          <MetricTile label="Sign-ups" value={m.lr_signups.toLocaleString()} />
          <MetricTile label="D1 Retention" value={pct(m.lr_retention_d1)} />
          <MetricTile label="D7 Retention" value={pct(m.lr_retention_d7)} />
        </div>
      )}
    </div>
  )
}
