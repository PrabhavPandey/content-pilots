import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: '#080808' }}>
      <nav className="border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tracking-widest uppercase text-zinc-500">TAL</span>
            <span className="text-zinc-700">/</span>
            <span className="text-sm text-zinc-400">Pilot Tracker</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-xs text-zinc-600">
              {session.user.role === 'admin' ? 'admin' : session.user.name}
            </span>
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
              <button type="submit" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}
