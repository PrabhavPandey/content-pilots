/**
 * End-to-end pipeline test
 * Run: node --env-file=.env.local scripts/test-pipeline.mjs
 *
 * Tests each layer of the qualification pipeline against live APIs:
 *   Linkrunner -> Mixpanel -> Metabase -> phone match -> Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const CAMPAIGN = 'the-other' // test against this pilot

const sep = (label) => console.log(`\n${'─'.repeat(50)}\n${label}\n${'─'.repeat(50)}`)

// ─── 1. LINKRUNNER ──────────────────────────────────────────────────────────
sep('1. LINKRUNNER')
try {
  const res = await fetch('https://api.linkrunner.io/v1/campaigns', {
    headers: { 'linkrunner-key': process.env.LINKRUNNER_API_KEY },
  })
  const data = await res.json()
  const campaigns = data?.data || data?.campaigns || data || []
  console.log(`Status: ${res.status}`)
  console.log(`Total campaigns returned: ${campaigns.length}`)
  if (campaigns.length > 0) {
    console.log('Field names on first campaign:', Object.keys(campaigns[0]).join(', '))
    const found = campaigns.find(c =>
      c.name?.toLowerCase() === CAMPAIGN || c.campaign_name?.toLowerCase() === CAMPAIGN
    )
    if (found) {
      console.log(`\n"${CAMPAIGN}" campaign data:`, JSON.stringify(found, null, 2))
    } else {
      console.warn(`Campaign "${CAMPAIGN}" NOT found. Available names:`,
        campaigns.map(c => c.name || c.campaign_name).join(', '))
    }
  } else {
    console.warn('Empty campaigns array. Raw response:', JSON.stringify(data).slice(0, 500))
  }
} catch (err) {
  console.error('Linkrunner FAILED:', err.message)
}

// ─── 2. MIXPANEL ─────────────────────────────────────────────────────────────
sep('2. MIXPANEL (JQL)')
try {
  const username = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET
  const projectId = process.env.MIXPANEL_PROJECT_ID ?? '3969008'
  const authHeader = 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64')

  const jql = `
    function main() {
      return People()
        .filter(function(user) {
          return user.properties['attribution_campaign_name'] === '${CAMPAIGN}';
        })
        .map(function(user) {
          return {
            phone: user.properties['$phone']
                || user.properties['phone_number']
                || user.properties['Phone']
                || null,
            city: user.properties['City']
               || user.properties['city']
               || user.properties['$city']
               || null,
          };
        });
    }
  `

  const res = await fetch('https://mixpanel.com/api/2.0/jql/', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ project_id: projectId, script: jql }),
  })

  console.log(`Status: ${res.status}`)
  if (!res.ok) {
    console.error('Mixpanel error:', await res.text())
  } else {
    const users = await res.json()
    console.log(`Users attributed to "${CAMPAIGN}": ${users.length}`)
    const withPhone = users.filter(u => u.phone)
    const withCity = users.filter(u => u.city)
    console.log(`  - with phone: ${withPhone.length}`)
    console.log(`  - with city: ${withCity.length}`)
    if (users.length > 0) {
      console.log('Sample (first 3):', JSON.stringify(users.slice(0, 3), null, 2))
    }
  }
} catch (err) {
  console.error('Mixpanel FAILED:', err.message)
}

// ─── 3. METABASE ─────────────────────────────────────────────────────────────
sep('3. METABASE (question 498)')
let metabaseUsers = []
try {
  const baseUrl = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
  const apiKey = process.env.METABASE_API_KEY

  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 180)
  const fmt = d => d.toISOString().split('T')[0]

  const res = await fetch(`${baseUrl}/api/card/498/query`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ignore_cache: true,
      parameters: [
        { type: 'date/single', value: fmt(start), target: ['variable', ['template-tag', 'start_date']] },
        { type: 'date/single', value: fmt(today), target: ['variable', ['template-tag', 'end_date']] },
      ],
    }),
  })

  console.log(`Status: ${res.status}`)
  if (!res.ok) {
    console.error('Metabase error:', await res.text())
  } else {
    const data = await res.json()
    const rows = data?.data?.rows ?? []
    const cols = (data?.data?.cols ?? []).map(c => c.name)
    console.log(`Columns: ${cols.join(', ')}`)
    console.log(`Total onboarded users (180d): ${rows.length}`)
    // Normalize sample
    metabaseUsers = rows.map(row => {
      const obj = Object.fromEntries(cols.map((col, i) => [col, row[i]]))
      const phone = (obj['Phone Number'] ?? obj['phone_number'] ?? obj['Phone'] ?? '').toString()
      const company = obj['Current Company'] ?? obj['current_company'] ?? obj['company'] ?? null
      return {
        phone: phone.replace(/\D/g, '').slice(-10),
        company: company ? String(company).trim() : null,
      }
    }).filter(u => u.phone.length >= 8)
    console.log(`  - with valid phone: ${metabaseUsers.length}`)
    console.log(`  - with company filled: ${metabaseUsers.filter(u => u.company).length}`)
    if (metabaseUsers.length > 0) {
      console.log('Sample (first 3):', JSON.stringify(metabaseUsers.slice(0, 3), null, 2))
    }
  }
} catch (err) {
  console.error('Metabase FAILED:', err.message)
}

// ─── 4. PHONE MATCH SIMULATION ───────────────────────────────────────────────
sep('4. PHONE MATCH (Mixpanel → Metabase)')
// Simulate with fake data since Mixpanel may have 0 users for this campaign right now
const fakeMixpanelUsers = [
  { phone: '9876543210', city: 'Bangalore' },
  { phone: '9123456789', city: 'Mumbai' },
  { phone: '7000000001', city: 'Patna' }, // non-qualifying city
]
const phoneMap = new Map(metabaseUsers.map(u => [u.phone, u]))
const QUALIFIED_CITIES = ['bangalore', 'bengaluru', 'mumbai', 'bombay', 'delhi', 'new delhi', 'gurgaon', 'gurugram', 'hyderabad', 'pune']
const isCityQualified = city => city && QUALIFIED_CITIES.some(c => city.toLowerCase().includes(c))

console.log('Simulating match with 3 fake Mixpanel users:')
for (const u of fakeMixpanelUsers) {
  const cityOk = isCityQualified(u.city)
  const metaUser = phoneMap.get(u.phone)
  console.log(`  phone=${u.phone} city=${u.city} → city_ok=${cityOk} in_metabase=${!!metaUser}`)
}
console.log(`Metabase phone map size: ${phoneMap.size} entries`)

// ─── 5. GEMINI ────────────────────────────────────────────────────────────────
sep('5. GEMINI (company classification)')
const testCompanies = ['Zepto', 'Infosys', 'Razorpay', 'TCS', 'Swiggy', 'HCL Technologies', 'CRED', 'Capgemini']
try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const PROMPT = `You are evaluating whether a user who installed TAL (a career platform for professionals at funded startups in India) is a "qualified install" for marketing attribution.

TAL's target audience: engineers, developers, PMs, designers, and business/growth/strategy professionals working at funded startups or growth-stage tech companies in Indian metro cities.

User data:
- Company: {company}

Evaluate the company. A user qualifies at the company level if:
- Works at a funded startup, early-stage or growth-stage tech company, or a well-known product-first tech company
- NOT at large IT outsourcing/services firms: TCS, Infosys, Wipro, Cognizant, HCL, Capgemini, Accenture, Tech Mahindra, Mphasis, L&T Infotech, and similar
- NOT at government organizations or PSUs
- NOT at educational institutions (colleges, schools, universities)
- NOT unemployed, freelancing with no company, or student
- NOT at a purely non-tech business (retail, FMCG, manufacturing, etc.) unless it is a funded tech-enabled startup

Respond with exactly one word: QUALIFIED or NOT_QUALIFIED`

  console.log('Testing Gemini on these companies:')
  for (const company of testCompanies) {
    const result = await model.generateContent(PROMPT.replace('{company}', company))
    const text = result.response.text().trim().toUpperCase()
    const qualified = text.includes('QUALIFIED') && !text.includes('NOT_QUALIFIED')
    console.log(`  ${company.padEnd(20)} → ${qualified ? '✅ QUALIFIED' : '❌ NOT_QUALIFIED'} (raw: "${text}")`)
  }
} catch (err) {
  console.error('Gemini FAILED:', err.message)
}

sep('TEST COMPLETE')
