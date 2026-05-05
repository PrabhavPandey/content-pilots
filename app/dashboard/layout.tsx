import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {/* Dark nav - frames the page */}
      <nav style={{ background: '#18181B' }}>
        <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-400"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              TAL
            </span>
            <span className="text-zinc-700 text-xs">/</span>
            <span
              className="text-xs font-semibold tracking-[0.18em] uppercase text-zinc-400"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              Pilot Tracker
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="text-xs text-zinc-500"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              {session.user.role === 'admin' ? 'Admin' : session.user.name}
            </span>
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
              <button
                type="submit"
                className="text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors"
                style={{ fontFamily: 'var(--font-inconsolata)' }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
