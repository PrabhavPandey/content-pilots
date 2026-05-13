// Debug — runs 10 users from a campaign through Gemini with full reasoning
// GET /api/debug/gemini-audit?secret=X&campaign=aarchi&pilot_type=ugc

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })

const UGC_PROMPT_WITH_REASON = `You are a classifier for TAL, an AI career app for working professionals in India.
Given a company name and job role, respond with QUALIFIED or NOT_QUALIFIED, then explain your reasoning in one sentence.

QUALIFIED if:
- The person works in a white-collar role: software engineering, product, design, growth, marketing, business development, strategy, consulting, analytics, finance, or any management/leadership role
- The company is a startup, product company, SaaS company, tech company, consulting firm, agency, fintech, healthtech, edtech, or global tech brand

NOT_QUALIFIED if:
- Job role is: student, intern, fresher, blue-collar, customer service, admin, data entry, operations support, field sales, driver, delivery, or any non-desk role
- Company is a Tier-1 IT outsourcing firm: TCS, Infosys, Wipro, Cognizant, HCL Technologies, Capgemini, Tech Mahindra, Mphasis, LTIMindtree, Hexaware, Birlasoft, Coforge, Zensar, or similar IT services/staffing company
- Company is a government body, PSU, public sector bank, school, college, or university
- Company is in manufacturing, retail, FMCG, real estate, logistics, paper/printing, construction, or any non-tech industry
- Company field is blank, "NA", "student", "freelancer", or clearly not a real company

When the company sounds like a small Indian IT services or outsourcing firm (body-shopping, staffing, IT contracts), default to NOT_QUALIFIED.

Company: {company}
Job role: {job_role}

Respond in this exact format:
VERDICT: QUALIFIED or NOT_QUALIFIED
REASON: one sentence explaining why`

const INFLUENCER_PROMPT_WITH_REASON = `You are a classifier for TAL, an AI career app for working professionals in India.
Given a company name and job role, respond with QUALIFIED or NOT_QUALIFIED, then explain your reasoning in one sentence.

QUALIFIED only if BOTH are true:
- Job role is: software engineer, developer, engineering manager, VP Engineering, CTO, product manager, product lead, or a direct variant of these
- Company is a startup or a global product/tech company (e.g. Google, Microsoft, Amazon, Meta, Apple, Uber, LinkedIn, Salesforce, Adobe, Atlassian)

NOT_QUALIFIED if either is true:
- Job role is anything other than software engineering or product management
- Company is a Tier-1 IT outsourcing firm: TCS, Infosys, Wipro, Cognizant, HCL Technologies, Capgemini, Tech Mahindra, Mphasis, LTIMindtree, Hexaware, Birlasoft, Coforge, Zensar, or similar
- Company is a government body, PSU, public sector bank, school, college, or university
- You are unsure if the company is a product startup or an IT services firm — default to NOT_QUALIFIED

Company: {company}
Job role: {job_role}

Respond in this exact format:
VERDICT: QUALIFIED or NOT_QUALIFIED
REASON: one sentence explaining why`

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaign  = req.nextUrl.searchParams.get('campaign') ?? 'aarchi'
  const pilotType = (req.nextUrl.searchParams.get('pilot_type') ?? 'ugc') as 'ugc' | 'influencer'
  const limit     = parseInt(req.nextUrl.searchParams.get('limit') ?? '100')

  const mpMap  = await getAllCampaignInstalls([campaign])
  const mpData = mpMap.get(campaign) ?? { first_app_opens: 0, users: [] }

  const phones = mpData.users.slice(0, limit).map((u: any) => u.phone)
  const metaUsers = phones.length > 0 ? await getOnboardedUsers(phones) : []

  const metaMap = new Map(metaUsers.map(u => [u.phone, u]))

  const template = pilotType === 'ugc' ? UGC_PROMPT_WITH_REASON : INFLUENCER_PROMPT_WITH_REASON

  const audits = []

  for (const mpUser of mpData.users.slice(0, limit)) {
    const meta = metaMap.get(mpUser.phone)
    if (!meta) {
      audits.push({
        phone_last4: mpUser.phone.slice(-4),
        city: mpUser.city,
        company: null,
        job_role: null,
        linkedin: null,
        verdict: 'SKIP',
        reason: 'not found in Metabase — not yet onboarded',
      })
      continue
    }

    const company = meta.company ?? 'unknown'
    const jobRole = meta.job_role ?? 'unknown'

    let verdict = 'ERROR'
    let reason  = ''

    try {
      const prompt = template
        .replace('{company}', company)
        .replace('{job_role}', jobRole)
      const result = await model.generateContent(prompt)
      const text   = result.response.text().trim()

      const verdictMatch = text.match(/VERDICT:\s*(QUALIFIED|NOT_QUALIFIED)/i)
      const reasonMatch  = text.match(/REASON:\s*(.+)/i)

      verdict = verdictMatch?.[1]?.toUpperCase() ?? 'PARSE_ERROR'
      reason  = reasonMatch?.[1]?.trim() ?? text
    } catch (e: any) {
      reason = e?.message ?? String(e)
    }

    audits.push({
      phone_last4: mpUser.phone.slice(-4),
      city:        mpUser.city ?? null,
      company,
      job_role:    jobRole,
      linkedin:    meta.linkedin ?? null,
      verdict,
      reason,
    })

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 150))
  }

  return NextResponse.json({
    campaign,
    pilot_type: pilotType,
    total_audited: audits.length,
    qualified: audits.filter(a => a.verdict === 'QUALIFIED').length,
    not_qualified: audits.filter(a => a.verdict === 'NOT_QUALIFIED').length,
    audits,
  })
}
