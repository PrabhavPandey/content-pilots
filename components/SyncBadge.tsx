'use client'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor(diff / (1000 * 60))
  if (hours >= 24) return `${Math.floor(hours / 24)}d ago`
  if (hours >= 1) return `${hours}h ago`
  if (mins >= 1) return `${mins}m ago`
  return 'just now'
}

export default function SyncBadge({ syncedAt }: { syncedAt: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 inline-block" />
      {timeAgo(syncedAt)}
    </div>
  )
}
