// Gemini qualification judge
// Only called for companies of users who clicked a campaign link AND onboarded.
// Results cached permanently in Supabase - each company is classified once, ever.

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

const QUALIFICATION_PROMPT = `You are evaluating whether an Indian professional is a good install for TAL, a career platform for people at startups and tech companies in India.

Company to evaluate: {company}

All users are based in Indian metro cities. Evaluate only whether the company is worth targeting.

QUALIFIED — respond QUALIFIED if the company is any of:
- Any startup (seed, early, growth, or late stage) operating in India or globally
- Any Indian product or tech company
- Any well-known global tech company (Google, Amazon, Microsoft, Flipkart, Swiggy, Zomato, Razorpay, CRED, etc.)
- Any company name you don't recognise — unknown names are almost always Indian startups, so default to QUALIFIED

NOT_QUALIFIED — respond NOT_QUALIFIED only if the company is clearly:
- A mass IT outsourcing or body-shopping firm: TCS, Infosys, Wipro, Cognizant, HCL, Capgemini, Accenture, Tech Mahindra, Mphasis, L&T Infotech, NIIT Technologies, Hexaware, Mindtree (pre-LTI merger), or any similar firm whose primary business is IT staffing
- A government body, PSU, defence organisation, or public sector bank (SBI, PNB, etc.)
- A college, university, school, or coaching institute
- Not a company at all: "unemployed", "student", "freelancer", "NA", blank, or clearly fake

IMPORTANT: If you are unsure or the company name is unfamiliar, respond QUALIFIED. Most unknown company names in this context are Indian startups.

Respond with exactly one word: QUALIFIED or NOT_QUALIFIED`

// In-memory cache for this function invocation
const sessionCache = new Map<string, boolean>()

// Call Gemini and persist result. Only call this when we KNOW the company is not cached.
async function callGemini(companyKey: string, db: SupabaseClient): Promise<boolean> {
  try {
    const prompt = QUALIFICATION_PROMPT.replace('{company}', companyKey)
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().toUpperCase()
    const isQualified = text.includes('QUALIFIED') && !text.includes('NOT_QUALIFIED')

    await db.from('company_classifications').upsert({
      company_name: companyKey,
      is_startup: isQualified,
      classified_at: new Date().toISOString(),
    }, { onConflict: 'company_name' })

    sessionCache.set(companyKey, isQualified)
    console.log(`Gemini: "${companyKey}" → ${isQualified ? 'startup' : 'not startup'}`)
    return isQualified
  } catch (err) {
    console.error(`Gemini failed for "${companyKey}":`, err)
    return false
  }
}

// Batch classify companies.
// 1. Single Supabase query for all → split into cached / uncached.
// 2. For uncached: call Gemini in parallel batches of 5 (no redundant DB check per company).
// 3. Returns a map of company_name → is_startup.
export async function batchClassifyCompanies(
  companies: string[],
  dbClient?: SupabaseClient
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  if (companies.length === 0) return results

  const db = dbClient ?? getServiceClient()
  const unique = [...new Set(companies.map(c => c?.toLowerCase().trim()).filter(Boolean))]

  // Single bulk Supabase lookup
  const { data: cached } = await db
    .from('company_classifications')
    .select('company_name, is_startup')
    .in('company_name', unique)

  const cachedMap = new Map((cached ?? []).map(r => [r.company_name, r.is_startup]))

  // Session cache hits + Supabase hits
  const uncached = unique.filter(c => !cachedMap.has(c) && !sessionCache.has(c))

  if (uncached.length > 0) {
    console.log(`Gemini: ${cachedMap.size + sessionCache.size} cached, ${uncached.length} to classify`)
    // Parallel batches of 5 — no per-company Supabase check (already done above)
    for (let i = 0; i < uncached.length; i += 5) {
      const batch = uncached.slice(i, i + 5)
      await Promise.all(batch.map(c => callGemini(c, db)))
      if (i + 5 < uncached.length) await new Promise(r => setTimeout(r, 200))
    }
  } else {
    console.log(`Gemini: all ${unique.length} from cache — 0 API calls`)
  }

  for (const company of companies) {
    const key = company?.toLowerCase().trim()
    if (!key) { results.set(company, false); continue }
    results.set(company, sessionCache.get(key) ?? cachedMap.get(key) ?? false)
  }

  return results
}
