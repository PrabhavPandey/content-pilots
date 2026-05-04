// Run: node scripts/debug-linkrunner.mjs
// Probes /v1/attributed-users with every plausible parameter combo

import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = {}
try {
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '')
  })
} catch { console.error('Could not read .env.local'); process.exit(1) }

const KEY = env.LINKRUNNER_API_KEY
if (!KEY) { console.error('LINKRUNNER_API_KEY not found'); process.exit(1) }
const BASE = 'https://api.linkrunner.io/api'

async function hit(path, label) {
  const url = `${BASE}${path}`
  try {
    const res = await fetch(url, { headers: { 'linkrunner-key': KEY, 'Content-Type': 'application/json' } })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    console.log(`\n── ${label || path}  [${res.status}]`)
    if (typeof body === 'string') { console.log(`   ${body.slice(0, 300)}`); return }
    console.log(`   Top keys: ${Object.keys(body).join(', ')}`)
    const inner = body.data?.attributed_users || body.data?.users || body.data?.campaigns || body.data || body.users || body.results || body
    if (Array.isArray(inner) && inner[0]) {
      console.log(`   Array(${inner.length}) keys: ${Object.keys(inner[0]).join(', ')}`)
      console.log(`   First: ${JSON.stringify(inner[0]).slice(0, 600)}`)
    } else if (typeof inner === 'object' && inner !== null) {
      console.log(`   ${JSON.stringify(inner).slice(0, 500)}`)
    }
  } catch (e) {
    console.log(`\n── ${label || path}  ERROR: ${e.message}`)
  }
}

// Known campaign display_id: eastern-monk = osBZBZ, the-other = glrEWM (from dashboard URL)
const today = new Date().toISOString().split('T')[0]
const ago30 = new Date(Date.now() - 30*24*3600*1000).toISOString().split('T')[0]

console.log('Probing /v1/attributed-users with parameter variations...\n')
await hit('/v1/attributed-users?campaign_id=glrEWM', 'attributed-users?campaign_id=glrEWM')
await hit('/v1/attributed-users?campaign_name=the-other', 'attributed-users?campaign_name=the-other')
await hit('/v1/attributed-users?display_id=glrEWM', 'attributed-users?display_id=glrEWM')
await hit(`/v1/attributed-users?campaign_id=glrEWM&start_date=${ago30}&end_date=${today}`, 'attributed-users with dates')
await hit('/v1/attributed-users?page=1&limit=10', 'attributed-users?page+limit')
await hit('/v1/attributed-users?limit=10', 'attributed-users?limit')
