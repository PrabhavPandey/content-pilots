// Gemini qualification judge
// Evaluates whether a TAL install is "qualified" based on city + company
// Criteria: right city + right job function city + startup/funded tech company
// Results are cached in Supabase by company name to avoid redundant API calls

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServiceClient } from './db'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

// Cities that qualify
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

const QUALIFICATION_PROMPT = `You are evaluating whether a user who installed TAL (a career platform for professionals at funded startups in India) is a "qualified install" for marketing attribution.

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

If the company name is empty, null, "unemployed", or clearly a non-qualifying entity, respond NOT_QUALIFIED.
If uncertain but the company sounds like a startup or tech company, lean toward QUALIFIED.

Respond with exactly one word: QUALIFIED or NOT_QUALIFIED`

// In-memory cache for this run (Supabase cache is the persistent layer)
const sessionCache = new Map<string, boolean>()

export async function isCompanyQualified(company: string | null | undefined): Promise<boolean> {
  if (!company || company.trim() === '') return false

  const key = company.toLowerCase().trim()

  // 1. Check in-memory session cache
  if (sessionCache.has(key)) return sessionCache.get(key)!

  // 2. Check Supabase persistent cache
  const db = getServiceClient()
  const { data: cached } = await db
    .from('company_classifications')
    .select('is_startup')
    .eq('company_name', key)
    .single()

  if (cached !== null) {
    sessionCache.set(key, cached.is_startup)
    return cached.is_startup
  }

  // 3. Call Gemini
  try {
    const prompt = QUALIFICATION_PROMPT.replace('{company}', company)
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().toUpperCase()
    const isQualified = text.includes('QUALIFIED') && !text.includes('NOT_QUALIFIED')

    // Persist to Supabase
    await db.from('company_classifications').upsert({
      company_name: key,
      is_startup: isQualified,
      classified_at: new Date().toISOString(),
    }, { onConflict: 'company_name' })

    sessionCache.set(key, isQualified)
    return isQualified
  } catch (err) {
    console.error(`Gemini classification failed for "${company}":`, err)
    return false // fail safe - don't count as qualified if we can't check
  }
}

// Batch classify a list of companies efficiently
// Returns a map of company_name -> is_qualified
export async function batchClassifyCompanies(
  companies: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  const unique = [...new Set(companies.map(c => c?.toLowerCase().trim()).filter(Boolean))]

  // Check Supabase cache for all at once
  const db = getServiceClient()
  const { data: cached } = await db
    .from('company_classifications')
    .select('company_name, is_startup')
    .in('company_name', unique)

  const cachedMap = new Map((cached ?? []).map(r => [r.company_name, r.is_startup]))

  // Classify uncached ones
  const uncached = unique.filter(c => !cachedMap.has(c) && !sessionCache.has(c))

  // Rate limit: process in batches of 5 with small delay
  for (let i = 0; i < uncached.length; i += 5) {
    const batch = uncached.slice(i, i + 5)
    await Promise.all(batch.map(c => isCompanyQualified(c)))
    if (i + 5 < uncached.length) await new Promise(r => setTimeout(r, 500))
  }

  // Build final results map
  for (const company of companies) {
    const key = company?.toLowerCase().trim()
    if (!key) { results.set(company, false); continue }
    const val = sessionCache.get(key) ?? cachedMap.get(key) ?? false
    results.set(company, val)
  }

  return results
}
