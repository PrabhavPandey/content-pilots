import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { signOut } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold tracking-widest uppercase text-gray-400"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              TAL
            </span>
            <span className="text-gray-300">/</span>
            <span
              className="text-xs font-semibold tracking-widest uppercase text-gray-400"
              style={{ fontFamily: 'var(--font-inconsolata)' }}
            >
              Pilot Tracker
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {session.user.role === 'admin' ? 'Admin' : session.user.name}
            </span>
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
              <button
                type="submit"
                className="text-xs font-medium text-gray-500 border border-gray-200 rounded px-3 py-1.5 hover:text-gray-800 hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-all duration-150"
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
