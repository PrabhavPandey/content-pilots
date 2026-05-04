// Run: node scripts/debug-linkrunner.mjs
// Finds where Linkrunner exposes click data

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
    console.log(`\n── ${label || path}`)
    console.log(`   Status: ${res.status}`)
    if (typeof body === 'string') { console.log(`   Body: ${body.slice(0, 200)}`); return }
    console.log(`   Top keys: ${Object.keys(body).join(', ')}`)
    const inner = body.data?.campaigns || body.data || body.campaigns || body.results || body
    if (Array.isArray(inner) && inner[0]) {
      console.log(`   Array[0] keys: ${Object.keys(inner[0]).join(', ')}`)
      console.log(`   Array[0]: ${JSON.stringify(inner[0]).slice(0, 600)}`)
    } else if (typeof inner === 'object') {
      console.log(`   Inner keys: ${Object.keys(inner).join(', ')}`)
      console.log(`   Inner: ${JSON.stringify(inner).slice(0, 600)}`)
    }
  } catch (e) {
    console.log(`\n── ${label || path}  ERROR: ${e.message}`)
  }
}

// We know campaigns is at /v1/campaigns - now find where clicks live
await hit('/v1/campaigns?page=1&limit=10', 'campaigns (first 10)')
await hit('/v1/data', 'data')
await hit('/v1/data/campaigns', 'data/campaigns')
await hit('/v1/link-stats', 'link-stats')
await hit('/v1/links', 'links')
await hit('/v1/campaign-stats', 'campaign-stats')
await hit('/v1/analytics', 'analytics')
await hit('/v1/attributed-users', 'attributed-users')
await hit('/v1/attributed_users', 'attributed_users')
// Try with a known display_id from the campaign list (eastern-monk = osBZBZ)
await hit('/v1/campaigns/osBZBZ', 'campaign by display_id')
await hit('/v1/campaigns/osBZBZ/stats', 'campaign stats by display_id')
