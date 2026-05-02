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
    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      Last synced {formatSyncTime(syncedAt)}
    </div>
  )
}
