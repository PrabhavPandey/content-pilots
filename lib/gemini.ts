// Gemini qualification judge
// Uses two prompts: one for UGC pilots, one for influencer pilots.
// Classifies by (company + job_role + pilot_type) — results cached in Supabase.
// Cache key stored in company_classifications.company_name as "{company}|||{jobRole}|||{type}"

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServiceClient } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })

const QUALIFIED_CITIES = [
  'bangalore', 'bengaluru',
  'mumbai', 'bombay',
  'delhi', 'new delhi',
  'gurgaon', 'gurugram',
  'hyderabad',
  'pune',
]

export function isCityQualified(city: string | null | undefined): boolean {
  if (!city) return false
  return QUALIFIED_CITIES.some(c => city.toLowerCase().includes(c))
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const UGC_PROMPT = `You are a classifier for TAL, an AI career app for working professionals in India.
Given a company name and job role, respond with QUALIFIED or NOT_QUALIFIED, then explain your reasoning in one sentence.

QUALIFIED if:
- The person works in a white-collar role: software engineering, product, design, growth, marketing, business development, strategy, consulting, analytics, finance, or any management/leadership role
- The company is a startup, product company, SaaS company, tech company, consulting firm, agency, fintech, healthtech, edtech, global tech brand, or a talent-dense professional services firm (e.g. Genpact, EXL, WNS)

NOT_QUALIFIED if:
- Job role is: student, intern, fresher, apprentice, blue-collar, customer service, admin, data entry, operations support, field sales, or any non-desk role
- Company is a Tier-1 IT outsourcing firm: TCS, Infosys, Wipro, Cognizant, HCL Technologies, Capgemini, Tech Mahindra, Mphasis, LTIMindtree, Hexaware, Birlasoft, Coforge, Zensar, or similar IT services/staffing company
- Company is a government body, PSU, or public sector bank (e.g. DRDO, ISRO, SBI, Coal India). Private financial institutions (e.g. NSE, BSE, HDFC, ICICI) are QUALIFIED.
- Company is a school, college, university, or coaching institute
- Company field is blank, "NA", "unknown", "student", "freelancer", "personal projects", or clearly not a real company
- Company is clearly non-tech: hotels, restaurants, retail, manufacturing, construction, or real estate

Company: {company}
Job role: {job_role}

Respond in this exact format:
VERDICT: QUALIFIED or NOT_QUALIFIED
REASON: one sentence explaining why`

const INFLUENCER_PROMPT = `You are a classifier for TAL, an AI career app for working professionals in India.
Given a company name and job role, respond with QUALIFIED or NOT_QUALIFIED, then explain your reasoning in one sentence.

QUALIFIED if BOTH are true:
- Job role is a white-collar professional role, including: software engineer, developer, engineering manager, VP Engineering, CTO, product manager, product lead, designer, graphic designer, UI/UX designer, motion designer, creative director, design lead, data analyst, business analyst, growth analyst, strategy, consulting, team lead, senior associate, manager, or a direct variant of these
- Company is a startup, global product/tech company (e.g. Google, Microsoft, Amazon, Meta, Apple, Uber, LinkedIn, Salesforce, Adobe, Atlassian), global financial institution or investment bank (e.g. State Street, Goldman Sachs, JP Morgan, Morgan Stanley, BlackRock, Fidelity, HSBC, Citi), or a creative agency / design studio (e.g. Red Baton, Ogilvy, Wunderman Thompson)

NOT_QUALIFIED if either is true:
- Job role is: student, intern, fresher, apprentice, blue-collar, customer service, admin, data entry, operations support, field sales, or any non-desk role
- Company is a Tier-1 IT outsourcing firm: TCS, Infosys, Wipro, Cognizant, HCL Technologies, Capgemini, Tech Mahindra, Mphasis, LTIMindtree, Hexaware, Birlasoft, Coforge, Zensar, or similar IT services/staffing company
- Company is a government body, PSU, public sector bank, school, college, or university
- Company field is blank, "NA", "student", "freelancer", or clearly not a real company
- You are unsure if the company is a legitimate private firm — default to NOT_QUALIFIED

Company: {company}
Job role: {job_role}

Respond in this exact format:
VERDICT: QUALIFIED or NOT_QUALIFIED
REASON: one sentence explaining why`

// ── Cache key ─────────────────────────────────────────────────────────────────

export function buildCacheKey(company: string, jobRole: string | null, pilotType: string): string {
  return `${company.toLowerCase().trim()}|||${(jobRole ?? '').toLowerCase().trim()}|||${pilotType}`
}

// ── In-memory session cache (per serverless invocation) ───────────────────────

export type CacheEntry = { qualified: boolean; reason: string | null }
const sessionCache = new Map<string, CacheEntry>()

// ── Gemini call + persist ─────────────────────────────────────────────────────

async function callGemini(
  company: string,
  jobRole: string | null,
  pilotType: 'ugc' | 'influencer',
  db: SupabaseClient
): Promise<CacheEntry> {
  const cacheKey = buildCacheKey(company, jobRole, pilotType)
  try {
    const template = pilotType === 'ugc' ? UGC_PROMPT : INFLUENCER_PROMPT
    const prompt = template
      .replace('{company}', company || 'unknown')
      .replace('{job_role}', jobRole || 'unknown')

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const verdictMatch = text.match(/VERDICT:\s*(QUALIFIED|NOT_QUALIFIED)/i)
    const reasonMatch  = text.match(/REASON:\s*(.+)/i)

    const isQualified = verdictMatch?.[1]?.toUpperCase() === 'QUALIFIED'
    const reason      = reasonMatch?.[1]?.trim() ?? null

    await db.from('company_classifications').upsert({
      company_name: cacheKey,
      is_startup: isQualified,
      reason,
      classified_at: new Date().toISOString(),
    }, { onConflict: 'company_name' })

    const entry: CacheEntry = { qualified: isQualified, reason }
    sessionCache.set(cacheKey, entry)
    console.log(`Gemini [${pilotType}]: "${company}" / "${jobRole}" → ${isQualified ? 'QUALIFIED' : 'NOT_QUALIFIED'}`)
    return entry
  } catch (err) {
    console.error(`Gemini failed for "${cacheKey}":`, err)
    return { qualified: false, reason: null }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type UserToClassify = {
  company: string
  jobRole: string | null
}

// Batch classify users for a given pilot type.
// Returns a Map keyed by buildCacheKey(company, jobRole, pilotType).
export async function batchClassifyUsers(
  users: UserToClassify[],
  pilotType: 'ugc' | 'influencer',
  dbClient?: SupabaseClient
): Promise<Map<string, CacheEntry>> {
  const results = new Map<string, CacheEntry>()
  if (users.length === 0) return results

  const db = dbClient ?? getServiceClient()

  // Deduplicate by cache key
  const unique = [...new Set(
    users
      .filter(u => u.company?.trim())
      .map(u => buildCacheKey(u.company, u.jobRole, pilotType))
  )]

  // Bulk Supabase lookup, batched.
  // PostgREST silently caps .select() at 1000 rows even with .limit(), AND .in()
  // with thousands of values can blow URL length limits. Chunk into 200-key blocks
  // and run them in parallel — cuts time and guarantees we get every cached row.
  const CACHE_CHUNK = 200
  const cacheChunks: string[][] = []
  for (let i = 0; i < unique.length; i += CACHE_CHUNK) {
    cacheChunks.push(unique.slice(i, i + CACHE_CHUNK))
  }

  const cachedMap = new Map<string, CacheEntry>()
  const chunkResults = await Promise.all(cacheChunks.map(chunk =>
    db.from('company_classifications')
      .select('company_name, is_startup, reason')
      .in('company_name', chunk)
      .then(r => r.data ?? [])
  ))
  for (const rows of chunkResults) {
    for (const r of rows) {
      cachedMap.set(r.company_name, { qualified: r.is_startup as boolean, reason: r.reason as string | null })
    }
  }

  const uncached = unique.filter(k => !cachedMap.has(k) && !sessionCache.has(k))

  if (uncached.length > 0) {
    console.log(`Gemini [${pilotType}]: ${cachedMap.size + sessionCache.size} cached, ${uncached.length} to classify`)
    for (let i = 0; i < uncached.length; i += 15) {
      const batch = uncached.slice(i, i + 15)
      await Promise.all(batch.map(key => {
        const [company, jobRole] = key.split('|||')
        return callGemini(company, jobRole || null, pilotType, db)
      }))
      if (i + 15 < uncached.length) await new Promise(r => setTimeout(r, 50))
    }
  } else {
    console.log(`Gemini [${pilotType}]: all ${unique.length} from cache — 0 API calls`)
  }

  for (const key of unique) {
    results.set(key, sessionCache.get(key) ?? cachedMap.get(key) ?? { qualified: false, reason: null })
  }

  return results
}
