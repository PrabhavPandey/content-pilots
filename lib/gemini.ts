// Gemini qualification judge
// Only called for companies of users who clicked a campaign link AND onboarded.
// Results cached permanently in Supabase - each company is classified once, ever.

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getServiceClient } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' })

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

const QUALIFICATION_PROMPT = `You are evaluating whether a company is a good target for TAL, a career platform for startup and tech professionals in India.

Company to evaluate: {company}

DEFAULT RULE: Respond QUALIFIED unless the company clearly matches one of the NOT_QUALIFIED cases below. When in doubt, always respond QUALIFIED.

NOT_QUALIFIED — respond NOT_QUALIFIED ONLY if the company is unambiguously one of these:
1. A Tier-1 IT outsourcing / body-shopping giant: TCS, Infosys, Wipro, Cognizant, HCL Technologies, Capgemini, Accenture, Tech Mahindra, Mphasis, LTIMindtree, L&T Technology Services, NIIT Technologies, Hexaware, Birlasoft, Persistent Systems, Mastech, Zensar, Coforge, or any company whose primary business is IT staffing or outsourcing contracts
2. A government body, PSU, defence org, or public sector bank: DRDO, ISRO, BSNL, SBI, PNB, Canara Bank, Indian Railways, ONGC, Coal India, HAL, etc.
3. A college, university, school, or coaching institute: IIT, IIM, Unacademy, BYJU's as an institution, etc.
4. Not a real company: "student", "unemployed", "freelancer", "self employed", "NA", "N/A", blank, or clearly nonsense

QUALIFIED — everything else. This includes:
- Any startup you've heard of or not — Indian startups rarely have famous names
- Small software / tech / SaaS companies with generic-sounding names (e.g. "Teamware Solutions", "EISystems", "Zophrix", "Karkhana")
- Product companies, agencies, consulting firms, fintech, edtech, healthtech, media companies
- Global tech companies (Google, Microsoft, Amazon, Meta, etc.)
- Indian new-age companies (Swiggy, Zomato, CRED, Razorpay, Zepto, etc.)

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
