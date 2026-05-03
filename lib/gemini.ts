// Gemini qualification judge
// Only called for companies of users who clicked a campaign link AND onboarded.
// Results are cached permanently in Supabase - each company is classified once, ever.

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServiceClient } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

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

// In-memory cache for the current function invocation (Supabase is the persistent layer)
const sessionCache = new Map<string, boolean>()

// Classify a single company. Accepts an optional db client to avoid creating one per call.
async function classifyOne(company: string, db: SupabaseClient): Promise<boolean> {
  const key = company.toLowerCase().trim()

  if (sessionCache.has(key)) return sessionCache.get(key)!

  // Check Supabase cache first
  const { data: cached } = await db
    .from('company_classifications')
    .select('is_startup')
    .eq('company_name', key)
    .maybeSingle()

  if (cached !== null && cached !== undefined) {
    sessionCache.set(key, cached.is_startup)
    return cached.is_startup
  }

  // Not cached - call Gemini
  try {
    const prompt = QUALIFICATION_PROMPT.replace('{company}', company)
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().toUpperCase()
    const isQualified = text.includes('QUALIFIED') && !text.includes('NOT_QUALIFIED')

    await db.from('company_classifications').upsert({
      company_name: key,
      is_startup: isQualified,
      classified_at: new Date().toISOString(),
    }, { onConflict: 'company_name' })

    sessionCache.set(key, isQualified)
    console.log(`Gemini: "${company}" → ${isQualified ? 'startup' : 'not startup'}`)
    return isQualified
  } catch (err) {
    console.error(`Gemini classification failed for "${company}":`, err)
    return false
  }
}

// Batch classify a list of companies.
// Accepts an optional db client - pass it from the caller to avoid N client instantiations.
// Only calls Gemini for companies not already in Supabase or session cache.
export async function batchClassifyCompanies(
  companies: string[],
  dbClient?: SupabaseClient
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  if (companies.length === 0) return results

  const db = dbClient ?? getServiceClient()
  const unique = [...new Set(companies.map(c => c?.toLowerCase().trim()).filter(Boolean))]

  // Batch-check Supabase cache in a single query
  const { data: cached } = await db
    .from('company_classifications')
    .select('company_name, is_startup')
    .in('company_name', unique)

  const cachedMap = new Map((cached ?? []).map(r => [r.company_name, r.is_startup]))

  // Only call Gemini for what's not cached anywhere
  const uncached = unique.filter(c => !cachedMap.has(c) && !sessionCache.has(c))

  if (uncached.length > 0) {
    console.log(`Gemini: ${cachedMap.size} from cache, ${uncached.length} need classification`)
    // Process concurrently in batches of 5 to respect rate limits
    for (let i = 0; i < uncached.length; i += 5) {
      const batch = uncached.slice(i, i + 5)
      await Promise.all(batch.map(c => classifyOne(c, db)))
      // Only delay between batches when there are more to process
      if (i + 5 < uncached.length) await new Promise(r => setTimeout(r, 200))
    }
  } else {
    console.log(`Gemini: all ${unique.length} companies served from cache, 0 API calls`)
  }

  // Build final map
  for (const company of companies) {
    const key = company?.toLowerCase().trim()
    if (!key) { results.set(company, false); continue }
    results.set(company, sessionCache.get(key) ?? cachedMap.get(key) ?? false)
  }

  return results
}
