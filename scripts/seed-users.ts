// Run once to create all 7 user accounts (admin + 6 pilots)
// Usage: npx ts-node --skip-project scripts/seed-users.ts
// OR just copy the INSERT SQL it prints into Supabase SQL editor

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(crypto.randomBytes(length))
    .map(b => chars[b % chars.length])
    .join('')
}

const PILOTS = [
  { id: 'the-other',    username: 'the-other',    role: 'pilot' },
  { id: 'third-draft',  username: 'third-draft',  role: 'pilot' },
  { id: 'dot',          username: 'dot-ugc',       role: 'pilot' },
  { id: 'yoursbossy',   username: 'yoursbossy',    role: 'pilot' },
  { id: 'aarchi',       username: 'aarchi',         role: 'pilot' },
  { id: 'eastern-monk', username: 'eastern-monk',  role: 'pilot' },
]

async function main() {
  const credentials: { username: string; password: string; role: string }[] = []

  // Admin account
  const adminPass = generatePassword()
  const adminHash = await bcrypt.hash(adminPass, 12)
  credentials.push({ username: 'prabhav', password: adminPass, role: 'admin' })

  const insertStatements: string[] = [
    `INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('prabhav', '${adminHash}', 'admin', NULL);`,
  ]

  for (const p of PILOTS) {
    const pass = generatePassword()
    const hash = await bcrypt.hash(pass, 12)
    credentials.push({ username: p.username, password: pass, role: 'pilot' })
    insertStatements.push(
      `INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('${p.username}', '${hash}', 'pilot', '${p.id}');`
    )
  }

  console.log('\n=== SQL TO RUN IN SUPABASE ===\n')
  console.log(insertStatements.join('\n'))

  console.log('\n\n=== CREDENTIALS TO SHARE ===\n')
  for (const c of credentials) {
    console.log(`${c.role === 'admin' ? '[ADMIN] ' : ''}${c.username}  /  ${c.password}`)
  }

  console.log('\n')
}

main().catch(console.error)
