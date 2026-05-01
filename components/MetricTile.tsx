type Props = {
  label: string
  value: string
  note?: string
  highlight?: boolean
}

export default function MetricTile({ label, value, note, highlight }: Props) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${highlight ? 'bg-violet-900/30 border border-violet-700/30' : 'bg-gray-800/50'}`}>
      <div className={`text-lg font-semibold tabular-nums ${highlight ? 'text-violet-300' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5 leading-tight">
        {label}
        {note && <span className="ml-1 text-gray-600">· {note}</span>}
      </div>
    </div>
  )
}
