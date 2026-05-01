import { PilotMetrics, Pilot } from '@/lib/db'

type Props = {
  metrics: PilotMetrics & { pilot: Pilot }
  isAdmin: boolean
  expanded?: boolean
}

function pct(n: number) {
  return `${Number(n).toFixed(1)}%`
}

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-semibold tabular-nums tracking-tight ${dim ? 'text-zinc-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-[11px] text-zinc-600 mt-0.5">{label}</div>
    </div>
  )
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-600">{label}</span>
      <span className="text-xs font-medium text-zinc-400 tabular-nums">{value}</span>
    </div>
  )
}

export default function PilotCard({ metrics: m }: Props) {
  return (
    <div className="rounded-xl border border-white/[0.06] p-5" style={{ background: '#111111' }}>

      {/* Top: name + qualified installs */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-sm font-medium text-white">{m.pilot.name}</h3>
          <span className="text-[11px] text-zinc-600 capitalize mt-0.5 block">{m.pilot.type}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-white tabular-nums">
            {m.qualified_installs.toLocaleString()}
          </div>
          <div className="text-[11px] text-zinc-600 mt-0.5">qualified</div>
        </div>
      </div>

      {/* Funnel stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Stat label="Clicks" value={m.lr_clicks.toLocaleString()} dim />
        <Stat label="Installs" value={m.lr_installs.toLocaleString()} dim />
        <Stat label="First open" value={m.mp_first_app_opens.toLocaleString()} dim />
      </div>

      {/* Conversion rates */}
      <div className="border-t border-white/[0.05] pt-4 space-y-2">
        <Rate label="Click → Install" value={pct(m.click_to_install_rate)} />
        <Rate label="Install → Qualified" value={pct(m.install_to_qualified_rate)} />
      </div>

    </div>
  )
}
