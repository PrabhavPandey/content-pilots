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

  const accent =
    state === 'done'  ? '#059669' :
    state === 'error' ? '#DC2626' :
    'var(--text-muted)'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'running'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-[0.12em] uppercase transition-opacity"
      style={{
        fontFamily: 'var(--font-inconsolata)',
        color: accent,
        border: `1px solid ${state === 'idle' || state === 'running' ? 'var(--border)' : accent}`,
        opacity: state === 'running' ? 0.6 : 1,
        background: 'transparent',
        cursor: state === 'running' ? 'not-allowed' : 'pointer',
      }}
    >
      {state === 'running' && (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-t-transparent animate-spin"
          style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }}
        />
      )}
      {label}
    </button>
  )
}
