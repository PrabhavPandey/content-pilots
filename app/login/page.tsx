'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { username, password, redirect: false })
    if (result?.error) {
      setError('Wrong username or password.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const inputBase = {
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1.5px solid var(--border)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    outline: 'none',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg-page)' }}
    >
      <div className="w-full max-w-[340px] fade-up">

        <div className="mb-10">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] uppercase mb-7"
            style={{ fontFamily: 'var(--font-inconsolata)', color: 'var(--text-muted)' }}
          >
            TAL · Pilot Tracker
          </p>
          <h1
            className="text-[28px] font-semibold leading-tight mb-1.5"
            style={{ fontFamily: 'var(--font-poppins)', color: 'var(--text-primary)' }}
          >
            Welcome back.
          </h1>
          <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
            Sign in to view your campaign.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm transition-colors duration-150"
            style={inputBase}
            onFocus={e => (e.target.style.borderColor = '#A1A1AA')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            placeholder="Username"
            required
            autoFocus
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm transition-colors duration-150"
            style={inputBase}
            onFocus={e => (e.target.style.borderColor = '#A1A1AA')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            placeholder="Password"
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="text-red-500 text-xs font-medium pl-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 active:scale-[0.99] transition-all duration-150 cursor-pointer"
            style={{
              background: '#1A1A1A',
              fontFamily: 'var(--font-poppins)',
              marginTop: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white opacity-70" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </span>
            ) : 'Sign in'}
          </button>
        </form>

      </div>
    </div>
  )
}
