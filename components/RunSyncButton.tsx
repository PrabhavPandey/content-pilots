'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RunSyncButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const router = useRouter()

  async function handleClick() {
    if (state === 'running') return
    setState('running')
    try {
      const res = await fetch('/api/admin/trigger-sync', { method: 'POST' })
      if (!res.ok) throw new Error(`${res.status}`)
      setState('done')
      // Refresh server data without a full navigation
      router.refresh()
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  const label =
    state === 'running' ? 'Syncing…' :
    state === 'done'    ? 'Done ✓'   :
    state === 'error'   ? 'Failed'   :
    'Run Sync'

  const bg =
    state === 'done'  ? '#059669' :
    state === 'error' ? '#DC2626' :
    '#111'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'running'}
      className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold tracking-[0.06em] uppercase transition-all"
      style={{
        fontFamily: 'var(--font-inconsolata)',
        color: '#fff',
        background: bg,
        border: 'none',
        opacity: state === 'running' ? 0.65 : 1,
        cursor: state === 'running' ? 'not-allowed' : 'pointer',
        lineHeight: '1.6',
      }}
    >
      {state === 'running' && (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] animate-spin"
          style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }}
        />
      )}
      {label}
    </button>
  )
}
