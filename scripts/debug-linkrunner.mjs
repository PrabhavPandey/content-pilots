// Run: node scripts/debug-linkrunner.mjs
// Requires LINKRUNNER_API_KEY in your .env.local

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local manually
const envPath = resolve(process.cwd(), '.env.local')
const env = {}
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '')
  })
} catch {
  console.error('Could not read .env.local')
  process.exit(1)
}

const API_KEY = env.LINKRUNNER_API_KEY
if (!API_KEY) { console.error('LINKRUNNER_API_KEY not found in .env.local'); process.exit(1) }

async function hit(url) {
  try {
    const res = await fetch(url, {
      headers: { 'linkrunner-key': API_KEY, 'Content-Type': 'application/json' }
    })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    console.log(`\n── ${url}`)
    console.log(`   Status: ${res.status}`)
    if (typeof body === 'object' && body !== null) {
      // If it's an array, show first item's keys + length
      if (Array.isArray(body)) {
        console.log(`   Array length: ${body.length}`)
        if (body[0]) console.log(`   First item keys: ${Object.keys(body[0]).join(', ')}`)
        if (body[0]) console.log(`   First item: ${JSON.stringify(body[0], null, 2)}`)
      } else {
        console.log(`   Keys: ${Object.keys(body).join(', ')}`)
        // If there's a data/campaigns array inside
        const arr = body.data || body.campaigns || body.results || null
        if (Array.isArray(arr)) {
          console.log(`   Inner array length: ${arr.length}`)
          if (arr[0]) console.log(`   First item keys: ${Object.keys(arr[0]).join(', ')}`)
          if (arr[0]) console.log(`   First item: ${JSON.stringify(arr[0], null, 2)}`)
        } else {
          console.log(`   Body: ${JSON.stringify(body, null, 2).slice(0, 800)}`)
        }
      }
    } else {
      console.log(`   Body: ${String(body).slice(0, 400)}`)
    }
  } catch (e) {
    console.log(`\n── ${url}`)
    console.log(`   ERROR: ${e.message}`)
  }
}

console.log('Probing Linkrunner API endpoints...\n')
await Promise.all([
  hit('https://api.linkrunner.io/v1/campaigns'),
  hit('https://api.linkrunner.io/api/v1/campaigns'),
  hit('https://api.linkrunner.io/v1/data'),
  hit('https://api.linkrunner.io/api/v1/data'),
  hit('https://api.linkrunner.io/v1/stats'),
  hit('https://api.linkrunner.io/api/v1/stats'),
])
