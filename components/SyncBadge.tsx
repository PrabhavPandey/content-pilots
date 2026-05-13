'use client'

function formatSyncTime(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDate()
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} ${month} · ${time}`
}

export default function SyncBadge({ syncedAt }: { syncedAt: string | null }) {
  if (!syncedAt) return null

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>
      <span
        className="text-[13px] font-medium"
        style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
      >
        Synced {formatSyncTime(syncedAt)}
      </span>
    </div>
  )
}
