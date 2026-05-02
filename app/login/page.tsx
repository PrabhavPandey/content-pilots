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

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-[360px]">

        {/* Header */}
        <div className="mb-8">
          <p
            className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-4"
            style={{ fontFamily: 'var(--font-inconsolata)' }}
          >
            TAL · Pilot Tracker
          </p>
          <h1
            className="text-2xl font-semibold text-gray-900 leading-snug"
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            Sign in
          </h1>
          <p className="text-sm text-gray-500 mt-1">Enter your credentials to view your campaign.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors"
            placeholder="Username"
            required
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors"
            placeholder="Password"
            required
          />

          {error && (
            <p className="text-red-600 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-3 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
