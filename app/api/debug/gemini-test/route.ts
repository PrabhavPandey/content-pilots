// Debug endpoint — test Gemini classification directly
// Pass ?company=emergent to test a specific company
// Pass ?companies=emergent,tcs,cred to test multiple
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

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

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const single   = req.nextUrl.searchParams.get('company')
  const multiple = req.nextUrl.searchParams.get('companies')

  const companies = single
    ? [single]
    : multiple
    ? multiple.split(',').map(c => c.trim()).filter(Boolean)
    : ['emergent', 'tcs', 'cred', 'infosys', 'razorpay', 'wipro', 'blursday.wtf', 'freelancer', 'iim bangalore']

  const results = []

  for (const company of companies) {
    try {
      const prompt = QUALIFICATION_PROMPT.replace('{company}', company)
      const result = await model.generateContent(prompt)
      const rawText = result.response.text().trim()
      const upper = rawText.toUpperCase()
      const isQualified = upper.includes('QUALIFIED') && !upper.includes('NOT_QUALIFIED')

      results.push({
        company,
        raw_response: rawText,
        verdict: isQualified ? 'QUALIFIED' : 'NOT_QUALIFIED',
        error: null,
      })
    } catch (err: any) {
      results.push({
        company,
        raw_response: null,
        verdict: 'ERROR',
        error: err?.message ?? String(err),
      })
    }
  }

  const allErrored = results.every(r => r.verdict === 'ERROR')

  return NextResponse.json({
    gemini_working: !allErrored,
    model: 'gemini-2.0-flash',
    results,
  })
}
