'use client'

import { useState } from 'react'

export default function SignOutButton({ action }: { action: () => Promise<void> }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    await action()
    // If redirect doesn't fire (e.g. error), reset
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-[12px] font-medium text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-800 px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        fontFamily: 'var(--font-inconsolata)',
        border: '1px solid #3F3F3F',
        minWidth: '72px',
      }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-1.5">
          <svg
            className="animate-spin"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Signing out
        </span>
      ) : (
        'Sign out'
      )}
    </button>
  )
}
