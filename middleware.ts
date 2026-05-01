import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Allow auth endpoints and login page
  if (
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Protect cron endpoint - auth handled inside the route itself (CRON_SECRET)
  if (pathname.startsWith('/api/cron')) {
    return NextResponse.next()
  }

  // All other routes require session
  if (!req.auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
