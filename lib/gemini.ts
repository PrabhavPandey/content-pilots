// Gemini qualification judge
// Uses two prompts: one for UGC pilots, one for influencer pilots.
// Classifies by (company + job_role + pilot_type) — results cached in Supabase.
// Cache key stored in company_classifications.company_name as "{company}|||{jobRole}|||{type}"

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServiceClient } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })

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
Given a company name and job role, respond with exactly one word: QUALIFIED or NOT_QUALIFIED

QUALIFIED if:
- The person works in a white-collar role: software engineering, product, design, growth, marketing, business development, strategy, consulting, analytics, finance, or any management/leadership role
- The company is a startup, product company, SaaS company, tech company, consulting firm, agency, fintech, healthtech, edtech, or global tech brand

NOT_QUALIFIED if:
- Job role is: student, intern, fresher, blue-collar, customer service, admin, data entry, operations support, field sales, driver, delivery, or any non-desk role
- Company is a Tier-1 IT outsourcing firm: TCS, Infosys, Wipro, Cognizant, HCL Technologies, Capgemini, Tech Mahindra, Mphasis, LTIMindtree, Hexaware, Birlasoft, Coforge, Zensar, or similar IT services/staffing company
- Company is a government body, PSU, public sector bank, school, college, or university
- Company field is blank, "NA", "student", "freelancer", or clearly not a real company

When the company sounds like a small Indian IT services or outsourcing firm (body-shopping, staffing, IT contracts), default to NOT_QUALIFIED.

Company: {company}
Job role: {job_role}`

const INFLUENCER_PROMPT = `You are a classifier for TAL, an AI career app for working professionals in India.
Given a company name and job role, respond with exactly one word: QUALIFIED or NOT_QUALIFIED

QUALIFIED only if BOTH are true:
- Job role is: software engineer, developer, engineering manager, VP Engineering, CTO, product manager, product lead, or a direct variant of these
- Company is a startup or a global product/tech company (e.g. Google, Microsoft, Amazon, Meta, Apple, Uber, LinkedIn, Salesforce, Adobe, Atlassian)

NOT_QUALIFIED if either is true:
- Job role is anything other than software engineering or product management
- Company is a Tier-1 IT outsourcing firm: TCS, Infosys, Wipro, Cognizant, HCL Technologies, Capgemini, Tech Mahindra, Mphasis, LTIMindtree, Hexaware, Birlasoft, Coforge, Zensar, or similar IT services/staffing company
- Company is a government body, PSU, public sector bank, school, college, or university
- Company field is blank, "NA", "student", "freelancer", or clearly not a real company
- You are unsure if the company is a product startup or an IT services firm — default to NOT_QUALIFIED

Company: {company}
Job role: {job_role}`

// ── Cache key ─────────────────────────────────────────────────────────────────

export function buildCacheKey(company: string, jobRole: string | null, pilotType: string): string {
  return `${company.toLowerCase().trim()}|||${(jobRole ?? '').toLowerCase().trim()}|||${pilotType}`
}

// ── In-memory session cache (per serverless invocation) ───────────────────────

const sessionCache = new Map<string, boolean>()

// ── Gemini call + persist ─────────────────────────────────────────────────────

async function callGemini(
  company: string,
  jobRole: string | null,
  pilotType: 'ugc' | 'influencer',
  db: SupabaseClient
): Promise<boolean> {
  const cacheKey = buildCacheKey(company, jobRole, pilotType)
  try {
    const template = pilotType === 'ugc' ? UGC_PROMPT : INFLUENCER_PROMPT
    const prompt = template
      .replace('{company}', company || 'unknown')
      .replace('{job_role}', jobRole || 'unknown')

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().toUpperCase()
    const isQualified = text.includes('QUALIFIED') && !text.includes('NOT_QUALIFIED')

    await db.from('company_classifications').upsert({
      company_name: cacheKey,
      is_startup: isQualified,
      classified_at: new Date().toISOString(),
    }, { onConflict: 'company_name' })

    sessionCache.set(cacheKey, isQualified)
    console.log(`Gemini [${pilotType}]: "${company}" / "${jobRole}" → ${isQualified ? 'QUALIFIED' : 'NOT_QUALIFIED'}`)
    return isQualified
  } catch (err) {
    console.error(`Gemini failed for "${cacheKey}":`, err)
    return false
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
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  if (users.length === 0) return results

  const db = dbClient ?? getServiceClient()

  // Deduplicate by cache key
  const unique = [...new Set(
    users
      .filter(u => u.company?.trim())
      .map(u => buildCacheKey(u.company, u.jobRole, pilotType))
  )]

  // Bulk Supabase lookup
  const { data: cached } = await db
    .from('company_classifications')
    .select('company_name, is_startup')
    .in('company_name', unique)

  const cachedMap = new Map((cached ?? []).map(r => [r.company_name, r.is_startup]))

  const uncached = unique.filter(k => !cachedMap.has(k) && !sessionCache.has(k))

  if (uncached.length > 0) {
    console.log(`Gemini [${pilotType}]: ${cachedMap.size + sessionCache.size} cached, ${uncached.length} to classify`)
    for (let i = 0; i < uncached.length; i += 5) {
      const batch = uncached.slice(i, i + 5)
      await Promise.all(batch.map(key => {
        const [company, jobRole] = key.split('|||')
        return callGemini(company, jobRole || null, pilotType, db)
      }))
      if (i + 5 < uncached.length) await new Promise(r => setTimeout(r, 200))
    }
  } else {
    console.log(`Gemini [${pilotType}]: all ${unique.length} from cache — 0 API calls`)
  }

  for (const key of unique) {
    results.set(key, sessionCache.get(key) ?? cachedMap.get(key) ?? false)
  }

  return results
}
