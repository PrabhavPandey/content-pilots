import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const signOutAction = async () => {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <nav style={{ background: '#111111', borderBottom: '1px solid #1C1C1C' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <span
              className="text-white text-[15px] font-semibold tracking-tight"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Pilot Tracker
            </span>
            <span className="text-zinc-700 text-xs select-none">·</span>
            <span
              className="text-[11px] font-semibold tracking-[0.2em] uppercase text-zinc-500"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              TAL
            </span>
          </div>

          {/* Right: user + sign out */}
          <div className="flex items-center gap-3">
            <span
              className="text-[13px] text-zinc-400"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              {session.user.role === 'admin' ? 'Admin' : session.user.name}
            </span>
            <SignOutButton action={signOutAction} />
          </div>

        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
