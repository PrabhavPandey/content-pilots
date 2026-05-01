import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getServiceClient } from './db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const db = getServiceClient()
        const { data: user } = await db
          .from('users')
          .select('*')
          .eq('username', credentials.username as string)
          .single()

        if (!user) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        )

        if (!valid) return null

        return {
          id: user.id,
          name: user.username,
          email: user.username,
          role: user.role,
          pilotId: user.pilot_id,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.pilotId = (user as any).pilotId
      }
      return token
    },
    session({ session, token }) {
      session.user.role = token.role as 'admin' | 'pilot'
      session.user.pilotId = token.pilotId as string | null
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
})

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role: 'admin' | 'pilot'
      pilotId: string | null
    }
  }
}
