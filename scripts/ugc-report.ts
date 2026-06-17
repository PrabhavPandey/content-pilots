import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load .env.local without dotenv dependency
const envPath = join(import.meta.dirname ?? __dirname, '..', '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Paginated fetch — PostgREST caps at 1000 rows
async function fetchAll(table: string, filter: Record<string, any> = {}): Promise<any[]> {
  const rows: any[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    let q = db.from(table).select('*').range(from, from + PAGE - 1)
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v)
    const { data } = await q
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return rows
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

function topN(map: Map<string, number>, n: number): [string, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

async function main() {
  // 1. Get UGC pilot IDs
  const { data: pilots } = await db
    .from('pilots')
    .select('*')
    .eq('type', 'ugc')

  const ugcPilots = (pilots ?? []).filter(p =>
    ['third-draft', 'aarchi'].includes(p.linkrunner_campaign_name)
  )

  console.log('='.repeat(80))
  console.log('TAL UGC PILOT REPORT — Full History (May 2026 – Today)')
  console.log('='.repeat(80))
  console.log(`Generated: ${new Date().toISOString().slice(0, 10)}`)
  console.log()

  // 2. Fetch pilot_installs for both UGC pilots
  for (const pilot of ugcPilots) {
    console.log('─'.repeat(80))
    console.log(`PILOT MODE: ${pilot.name} (${pilot.linkrunner_campaign_name})`)
    console.log('─'.repeat(80))

    const installs = await fetchAll('pilot_installs', { pilot_id: pilot.id })
    analyzeInstalls(installs, pilot.name)
  }

  // 3. Fetch campaign_installs for graduated campaigns
  for (const campaignSlug of ['tdf', 'aarchi']) {
    console.log('─'.repeat(80))
    console.log(`CAMPAIGN MODE: ${campaignSlug.toUpperCase()}`)
    console.log('─'.repeat(80))

    const installs = await fetchAll('campaign_installs', { campaign_slug: campaignSlug })
    analyzeInstalls(installs, campaignSlug, true)
  }

  // 4. Fetch latest metrics for funnel comparison
  console.log()
  console.log('='.repeat(80))
  console.log('FUNNEL METRICS (latest sync)')
  console.log('='.repeat(80))

  // Pilot metrics
  for (const pilot of ugcPilots) {
    const { data: metrics } = await db
      .from('pilot_metrics')
      .select('*')
      .eq('pilot_id', pilot.id)
      .order('fetched_at', { ascending: false })
      .limit(1)

    const m = metrics?.[0]
    if (m) {
      console.log()
      console.log(`${pilot.name} (Pilot Mode):`)
      console.log(`  Clicks:          ${m.lr_clicks?.toLocaleString() ?? 0}`)
      console.log(`  Installs:        ${m.lr_installs?.toLocaleString() ?? 0}`)
      console.log(`  Sign-ups:        ${m.lr_signups?.toLocaleString() ?? 0}`)
      console.log(`  Onboarded:       ${m.mp_first_app_opens?.toLocaleString() ?? 0}`)
      console.log(`  Qualified:       ${m.qualified_installs?.toLocaleString() ?? 0}`)
      const ctr = m.lr_clicks > 0 ? ((m.lr_installs / m.lr_clicks) * 100).toFixed(1) : '0.0'
      const qualRate = m.lr_installs > 0 ? ((m.qualified_installs / m.lr_installs) * 100).toFixed(1) : '0.0'
      console.log(`  Click→Install:   ${ctr}%`)
      console.log(`  Install→Qual:    ${qualRate}%`)
    }
  }

  // Campaign metrics
  for (const slug of ['tdf', 'aarchi']) {
    const { data: metrics } = await db
      .from('campaign_metrics')
      .select('*')
      .eq('campaign_slug', slug)
      .order('fetched_at', { ascending: false })
      .limit(1)

    const m = metrics?.[0]
    if (m) {
      console.log()
      console.log(`${slug.toUpperCase()} (Campaign Mode):`)
      console.log(`  Clicks:          ${m.lr_clicks?.toLocaleString() ?? 0}`)
      console.log(`  Installs:        ${m.lr_installs?.toLocaleString() ?? 0}`)
      console.log(`  Sign-ups:        ${m.lr_signups?.toLocaleString() ?? 0}`)
      console.log(`  Onboarded:       ${m.mp_first_app_opens?.toLocaleString() ?? 0}`)
      console.log(`  Qualified:       ${m.qualified_installs?.toLocaleString() ?? 0}`)
      const ctr = m.lr_clicks > 0 ? ((m.lr_installs / m.lr_clicks) * 100).toFixed(1) : '0.0'
      const qualRate = m.lr_installs > 0 ? ((m.qualified_installs / m.lr_installs) * 100).toFixed(1) : '0.0'
      console.log(`  Click→Install:   ${ctr}%`)
      console.log(`  Install→Qual:    ${qualRate}%`)
    }
  }

  // 5. Overall combined UGC stats
  console.log()
  console.log('='.repeat(80))
  console.log('COMBINED UGC — ALL USER-LEVEL DATA')
  console.log('='.repeat(80))

  // Use pilot_installs as the single source (contains all attributed users across both pilots)
  const allPilotInstalls: any[] = []
  for (const pilot of ugcPilots) {
    const installs = await fetchAll('pilot_installs', { pilot_id: pilot.id })
    allPilotInstalls.push(...installs.map(i => ({ ...i, pilot_name: pilot.name })))
  }
  analyzeInstalls(allPilotInstalls, 'ALL UGC COMBINED')
}

function analyzeInstalls(installs: any[], label: string, isCampaign = false) {
  const total = installs.length
  console.log()
  console.log(`Total onboarded users: ${total.toLocaleString()}`)

  if (total === 0) {
    console.log('  (no data)')
    return
  }

  const qualified = installs.filter(i => i.is_qualified)
  const notQualified = installs.filter(i => !i.is_qualified)
  const companyQualified = installs.filter(i => i.is_company_qualified)

  console.log(`Qualified:             ${qualified.length.toLocaleString()} (${pct(qualified.length, total)})`)
  console.log(`Not qualified:         ${notQualified.length.toLocaleString()} (${pct(notQualified.length, total)})`)
  console.log(`Company qualified:     ${companyQualified.length.toLocaleString()} (${pct(companyQualified.length, total)})`)

  // ── Job role distribution ───────────────────────────────────────────
  console.log()
  console.log(`JOB ROLE DISTRIBUTION (${label}):`)
  const roleMap = new Map<string, number>()
  const roleQualMap = new Map<string, number>()
  for (const i of installs) {
    const role = (i.job_role ?? 'Unknown/Blank').trim() || 'Unknown/Blank'
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1)
    if (i.is_qualified) roleQualMap.set(role, (roleQualMap.get(role) ?? 0) + 1)
  }
  const topRoles = topN(roleMap, 25)
  console.log(`  ${'Role'.padEnd(45)} ${'Count'.padStart(6)} ${'%'.padStart(7)} ${'Qual'.padStart(6)} ${'Qual%'.padStart(7)}`)
  console.log(`  ${'-'.repeat(45)} ${'-'.repeat(6)} ${'-'.repeat(7)} ${'-'.repeat(6)} ${'-'.repeat(7)}`)
  for (const [role, count] of topRoles) {
    const q = roleQualMap.get(role) ?? 0
    console.log(`  ${role.slice(0, 45).padEnd(45)} ${String(count).padStart(6)} ${pct(count, total).padStart(7)} ${String(q).padStart(6)} ${pct(q, count).padStart(7)}`)
  }
  const othersCount = total - topRoles.reduce((s, [, c]) => s + c, 0)
  if (othersCount > 0) console.log(`  ${'(others)'.padEnd(45)} ${String(othersCount).padStart(6)} ${pct(othersCount, total).padStart(7)}`)

  // ── Company distribution ────────────────────────────────────────────
  console.log()
  console.log(`COMPANY DISTRIBUTION (${label}):`)
  const companyMap = new Map<string, number>()
  const companyQualCountMap = new Map<string, number>()
  for (const i of installs) {
    const company = (i.company ?? 'Unknown/Blank').trim() || 'Unknown/Blank'
    companyMap.set(company, (companyMap.get(company) ?? 0) + 1)
    if (i.is_qualified) companyQualCountMap.set(company, (companyQualCountMap.get(company) ?? 0) + 1)
  }
  const topCompanies = topN(companyMap, 25)
  console.log(`  ${'Company'.padEnd(45)} ${'Count'.padStart(6)} ${'%'.padStart(7)} ${'Qual'.padStart(6)}`)
  console.log(`  ${'-'.repeat(45)} ${'-'.repeat(6)} ${'-'.repeat(7)} ${'-'.repeat(6)}`)
  for (const [company, count] of topCompanies) {
    const q = companyQualCountMap.get(company) ?? 0
    console.log(`  ${company.slice(0, 45).padEnd(45)} ${String(count).padStart(6)} ${pct(count, total).padStart(7)} ${String(q).padStart(6)}`)
  }
  const uniqueCompanies = companyMap.size
  console.log(`  Total unique companies: ${uniqueCompanies}`)

  // ── Company type bucketing ──────────────────────────────────────────
  console.log()
  console.log(`COMPANY TYPE BUCKETS (${label}):`)
  const buckets: Record<string, { count: number; qualified: number }> = {
    'IT Outsourcing (TCS/Infy/Wipro/etc)': { count: 0, qualified: 0 },
    'Startup / Product Co': { count: 0, qualified: 0 },
    'Big Tech (FAANG/Global)': { count: 0, qualified: 0 },
    'Consulting / Agency': { count: 0, qualified: 0 },
    'Fintech / Finance': { count: 0, qualified: 0 },
    'Govt / PSU / Public Sector': { count: 0, qualified: 0 },
    'Education (Student/University)': { count: 0, qualified: 0 },
    'Unknown / Blank': { count: 0, qualified: 0 },
    'Other': { count: 0, qualified: 0 },
  }

  const itOutsourcing = ['tcs', 'infosys', 'wipro', 'cognizant', 'hcl', 'capgemini', 'tech mahindra', 'mphasis', 'ltimindtree', 'hexaware', 'birlasoft', 'coforge', 'zensar', 'persistent', 'mindtree', 'l&t infotech']
  const bigTech = ['google', 'microsoft', 'amazon', 'meta', 'apple', 'uber', 'linkedin', 'salesforce', 'adobe', 'atlassian', 'oracle', 'ibm', 'samsung', 'intel', 'nvidia']
  const consulting = ['deloitte', 'mckinsey', 'bcg', 'bain', 'accenture', 'pwc', 'kpmg', 'ey ', 'ernst']
  const fintech = ['razorpay', 'paytm', 'phonepe', 'cred', 'groww', 'zerodha', 'bajaj', 'hdfc', 'icici', 'axis', 'kotak', 'jpmorgan', 'goldman', 'morgan stanley', 'stripe']
  const govt = ['drdo', 'isro', 'sbi', 'government', 'ministry', 'municipal', 'psu', 'bhel', 'ongc', 'ntpc', 'coal india', 'indian army', 'indian navy', 'air force']
  const education = ['university', 'college', 'institute', 'school', 'iit ', 'nit ', 'bits', 'student', 'vit ', 'srm ', 'amity']

  for (const i of installs) {
    const co = (i.company ?? '').toLowerCase().trim()
    const role = (i.job_role ?? '').toLowerCase().trim()
    const isQ = i.is_qualified

    if (!co || co === 'na' || co === 'unknown') {
      buckets['Unknown / Blank'].count++
      if (isQ) buckets['Unknown / Blank'].qualified++
    } else if (itOutsourcing.some(x => co.includes(x))) {
      buckets['IT Outsourcing (TCS/Infy/Wipro/etc)'].count++
      if (isQ) buckets['IT Outsourcing (TCS/Infy/Wipro/etc)'].qualified++
    } else if (bigTech.some(x => co.includes(x))) {
      buckets['Big Tech (FAANG/Global)'].count++
      if (isQ) buckets['Big Tech (FAANG/Global)'].qualified++
    } else if (consulting.some(x => co.includes(x))) {
      buckets['Consulting / Agency'].count++
      if (isQ) buckets['Consulting / Agency'].qualified++
    } else if (fintech.some(x => co.includes(x))) {
      buckets['Fintech / Finance'].count++
      if (isQ) buckets['Fintech / Finance'].qualified++
    } else if (govt.some(x => co.includes(x))) {
      buckets['Govt / PSU / Public Sector'].count++
      if (isQ) buckets['Govt / PSU / Public Sector'].qualified++
    } else if (education.some(x => co.includes(x)) || role.includes('student') || role.includes('intern')) {
      buckets['Education (Student/University)'].count++
      if (isQ) buckets['Education (Student/University)'].qualified++
    } else {
      buckets['Startup / Product Co'].count++
      if (isQ) buckets['Startup / Product Co'].qualified++
    }
  }

  console.log(`  ${'Type'.padEnd(40)} ${'Count'.padStart(6)} ${'%'.padStart(7)} ${'Qual'.padStart(6)} ${'Qual%'.padStart(7)}`)
  console.log(`  ${'-'.repeat(40)} ${'-'.repeat(6)} ${'-'.repeat(7)} ${'-'.repeat(6)} ${'-'.repeat(7)}`)
  for (const [type, { count, qualified: q }] of Object.entries(buckets).sort((a, b) => b[1].count - a[1].count)) {
    if (count === 0) continue
    console.log(`  ${type.padEnd(40)} ${String(count).padStart(6)} ${pct(count, total).padStart(7)} ${String(q).padStart(6)} ${pct(q, count).padStart(7)}`)
  }

  // ── City distribution ───────────────────────────────────────────────
  console.log()
  console.log(`CITY DISTRIBUTION (${label}):`)
  const cityMap = new Map<string, number>()
  const cityQualMap = new Map<string, number>()
  for (const i of installs) {
    const city = (i.city ?? 'Unknown').trim() || 'Unknown'
    cityMap.set(city, (cityMap.get(city) ?? 0) + 1)
    if (i.is_qualified) cityQualMap.set(city, (cityQualMap.get(city) ?? 0) + 1)
  }
  const topCities = topN(cityMap, 20)
  console.log(`  ${'City'.padEnd(30)} ${'Count'.padStart(6)} ${'%'.padStart(7)} ${'Qual'.padStart(6)}`)
  console.log(`  ${'-'.repeat(30)} ${'-'.repeat(6)} ${'-'.repeat(7)} ${'-'.repeat(6)}`)
  for (const [city, count] of topCities) {
    const q = cityQualMap.get(city) ?? 0
    console.log(`  ${city.slice(0, 30).padEnd(30)} ${String(count).padStart(6)} ${pct(count, total).padStart(7)} ${String(q).padStart(6)}`)
  }

  // ── Gemini NOT_QUALIFIED reasons ────────────────────────────────────
  console.log()
  console.log(`NOT_QUALIFIED REASONS (${label}):`)
  const reasonMap = new Map<string, number>()
  for (const i of notQualified) {
    const reason = (i.gemini_reason ?? 'No reason given').trim() || 'No reason given'
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1)
  }
  const topReasons = topN(reasonMap, 20)
  console.log(`  ${'Reason'.padEnd(80)} ${'Count'.padStart(6)}`)
  console.log(`  ${'-'.repeat(80)} ${'-'.repeat(6)}`)
  for (const [reason, count] of topReasons) {
    console.log(`  ${reason.slice(0, 80).padEnd(80)} ${String(count).padStart(6)}`)
  }

  // ── Role type bucketing (blue-collar / white-collar / student / unknown) ──
  console.log()
  console.log(`ROLE TYPE BREAKDOWN (${label}):`)
  const blueCollar = ['driver', 'delivery', 'warehouse', 'security', 'guard', 'cleaning', 'housekeeping', 'cook', 'chef', 'mechanic', 'plumber', 'electrician', 'carpenter', 'painter', 'labour', 'labor', 'helper', 'peon', 'sweeper', 'loader', 'field', 'technician']
  const studentRoles = ['student', 'fresher', 'intern', 'trainee', 'apprentice']
  const salesOps = ['customer service', 'customer support', 'telecaller', 'tele caller', 'bpo', 'call center', 'data entry', 'back office', 'admin', 'receptionist', 'front desk', 'office boy', 'office assistant']

  let blueCollarCount = 0, studentCount = 0, salesOpsCount = 0, whiteCollarCount = 0, unknownRoleCount = 0
  for (const i of installs) {
    const role = (i.job_role ?? '').toLowerCase().trim()
    if (!role) {
      unknownRoleCount++
    } else if (blueCollar.some(x => role.includes(x))) {
      blueCollarCount++
    } else if (studentRoles.some(x => role.includes(x))) {
      studentCount++
    } else if (salesOps.some(x => role.includes(x))) {
      salesOpsCount++
    } else {
      whiteCollarCount++
    }
  }

  console.log(`  White-collar professional: ${whiteCollarCount.toLocaleString()} (${pct(whiteCollarCount, total)})`)
  console.log(`  Student / Fresher / Intern: ${studentCount.toLocaleString()} (${pct(studentCount, total)})`)
  console.log(`  Sales / BPO / Support:      ${salesOpsCount.toLocaleString()} (${pct(salesOpsCount, total)})`)
  console.log(`  Blue-collar:                ${blueCollarCount.toLocaleString()} (${pct(blueCollarCount, total)})`)
  console.log(`  Unknown / Blank role:       ${unknownRoleCount.toLocaleString()} (${pct(unknownRoleCount, total)})`)

  // ── Creator-level breakdown (campaign mode only) ────────────────────
  if (isCampaign && installs.length > 0 && installs[0].creator_slug) {
    console.log()
    console.log(`PER-CREATOR BREAKDOWN (${label}):`)
    const creatorMap = new Map<string, { total: number; qualified: number }>()
    for (const i of installs) {
      const slug = i.creator_label ?? i.creator_slug ?? 'unknown'
      const entry = creatorMap.get(slug) ?? { total: 0, qualified: 0 }
      entry.total++
      if (i.is_qualified) entry.qualified++
      creatorMap.set(slug, entry)
    }
    const sortedCreators = [...creatorMap.entries()].sort((a, b) => b[1].total - a[1].total)
    console.log(`  ${'Creator'.padEnd(20)} ${'Onboarded'.padStart(10)} ${'Qualified'.padStart(10)} ${'Qual%'.padStart(8)}`)
    console.log(`  ${'-'.repeat(20)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(8)}`)
    for (const [slug, { total: t, qualified: q }] of sortedCreators) {
      console.log(`  ${slug.padEnd(20)} ${String(t).padStart(10)} ${String(q).padStart(10)} ${pct(q, t).padStart(8)}`)
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
