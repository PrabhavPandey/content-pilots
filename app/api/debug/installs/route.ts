// Debug endpoint — verbose per-install qualification breakdown
// Shows exactly why each Mixpanel user was accepted or rejected
// Protected by CRON_SECRET (same as sync)

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/db'
import { getAllCampaignInstalls } from '@/lib/mixpanel'
import { getOnboardedUsers } from '@/lib/metabase'
import { isCityQualified, batchClassifyCompanies } from '@/lib/gemini'

type InstallVerdict = {
  phone_last4: string
  city: string | null
  city_qualified: boolean
  found_in_metabase: boolean
  company: string | null
  gemini_verdict: 'QUALIFIED' | 'NOT_QUALIFIED' | 'UNKNOWN' | null
  final: 'QUALIFIED' | 'REJECTED'
  rejection_reason: string | null
}

type PilotReport = {
  pilot: string
  campaign_key: string
  mp_total_users: number
  mp_users_with_phone: number
  metabase_matches: number
  qualified: number
  installs: InstallVerdict[]
}

export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pilotFilter = req.nextUrl.searchParams.get('pilot') // optional: filter to one pilot

  const db = getServiceClient()

  const { data: pilots, error } = await db
    .from('pilots')
    .select('*')
    .eq('active', true)

  if (error || !pilots) {
    return NextResponse.json({ error: 'Failed to fetch pilots' }, { status: 500 })
  }

  const campaignNames = pilots.map(p => p.linkrunner_campaign_name?.toLowerCase().trim() ?? '')

  const [mpMap, metabaseUsers] = await Promise.allSettled([
    getAllCampaignInstalls(campaignNames),
    getOnboardedUsers(),
  ]).then(([mp, mb]) => [
    mp.status === 'fulfilled' ? mp.value : new Map(),
    mb.status === 'fulfilled' ? mb.value : [],
  ] as const)

  // Build phone → {company, name} map from Metabase
  const phoneToMeta = new Map<string, { company: string | null; name: string | null }>()
  for (const u of metabaseUsers as any[]) {
    if (u.phone) phoneToMeta.set(u.phone, { company: u.company, name: u.name })
  }

  // Collect all companies we need to classify
  const allAttributedPhones = new Set<string>()
  for (const name of campaignNames) {
    const bucket = (mpMap as Map<string, any>).get(name)
    bucket?.users.forEach((u: any) => { if (u.phone) allAttributedPhones.add(u.phone) })
  }

  const companiesToClassify: string[] = []
  for (const phone of allAttributedPhones) {
    const meta = phoneToMeta.get(phone)
    if (meta?.company) companiesToClassify.push(meta.company.toLowerCase().trim())
  }

  const companyMap = companiesToClassify.length > 0
    ? await batchClassifyCompanies([...new Set(companiesToClassify)], db)
    : new Map<string, boolean>()

  const reports: PilotReport[] = []

  for (const pilot of pilots) {
    if (pilotFilter && !pilot.name.toLowerCase().includes(pilotFilter.toLowerCase())) continue

    const campaignKey = pilot.linkrunner_campaign_name?.toLowerCase().trim() ?? ''
    const mpData = (mpMap as Map<string, any>).get(campaignKey) ?? { first_app_opens: 0, users: [] }

    const installs: InstallVerdict[] = []

    // Also track users with no phone (they come from first_app_opens count but have no phone)
    const usersWithPhone = mpData.users.length
    const totalMpUsers = mpData.first_app_opens

    for (const mpUser of mpData.users) {
      const phone = mpUser.phone
      const city = mpUser.city ?? null
      const cityQualified = isCityQualified(city)

      const meta = phoneToMeta.get(phone)
      const foundInMetabase = !!meta
      const company = meta?.company ?? null
      const companyKey = company?.toLowerCase().trim() ?? null

      let geminiVerdict: InstallVerdict['gemini_verdict'] = null
      let rejectionReason: string | null = null
      let finalVerdict: 'QUALIFIED' | 'REJECTED' = 'REJECTED'

      if (!cityQualified) {
        rejectionReason = `city_not_qualified (city: ${city ?? 'null'})`
      } else if (!foundInMetabase) {
        rejectionReason = 'not_found_in_metabase'
      } else if (!company) {
        rejectionReason = 'no_company_in_metabase'
      } else {
        const isQualified = companyMap.get(companyKey!) ?? false
        geminiVerdict = isQualified ? 'QUALIFIED' : 'NOT_QUALIFIED'
        if (!isQualified) {
          rejectionReason = `company_not_qualified (company: ${company})`
        } else {
          finalVerdict = 'QUALIFIED'
        }
      }

      installs.push({
        phone_last4: phone.slice(-4),
        city,
        city_qualified: cityQualified,
        found_in_metabase: foundInMetabase,
        company,
        gemini_verdict: geminiVerdict,
        final: finalVerdict,
        rejection_reason: rejectionReason,
      })
    }

    const qualified = installs.filter(i => i.final === 'QUALIFIED').length

    reports.push({
      pilot: pilot.name,
      campaign_key: campaignKey,
      mp_total_users: totalMpUsers,
      mp_users_with_phone: usersWithPhone,
      metabase_matches: installs.filter(i => i.found_in_metabase).length,
      qualified,
      installs,
    })
  }

  // Summary across all pilots
  const summary = {
    total_mp_users: reports.reduce((s, r) => s + r.mp_total_users, 0),
    total_with_phone: reports.reduce((s, r) => s + r.mp_users_with_phone, 0),
    total_metabase_matches: reports.reduce((s, r) => s + r.metabase_matches, 0),
    total_qualified: reports.reduce((s, r) => s + r.qualified, 0),
    metabase_total_users: (metabaseUsers as any[]).length,
    rejection_breakdown: {} as Record<string, number>,
  }

  for (const report of reports) {
    for (const install of report.installs) {
      if (install.rejection_reason) {
        const key = install.rejection_reason.split(' (')[0] // strip detail for grouping
        summary.rejection_breakdown[key] = (summary.rejection_breakdown[key] ?? 0) + 1
      }
    }
  }

  return NextResponse.json({ generated_at: new Date().toISOString(), summary, pilots: reports })
}
