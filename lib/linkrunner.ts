// Linkrunner Reporting API client
// Docs: https://docs.linkrunner.io/api-reference/reporting
// Base URL: https://api.linkrunner.io/api/v1
//
// Uses GET /reporting/campaigns - returns clicks, installs, sign-ups, retention, spend, etc.
// Numeric fields come back as formatted strings ("3,201") or raw numbers - we handle both.
// Rate limit: 1 req/min per API key. We fetch all pages in sequence, not parallel.
//
// CONFIRMED fields (live-tested 2026-05-05):
//   clicks, installs, "sign-ups" - all present and matching Linkrunner dashboard values

const BASE_URL = 'https://api.linkrunner.io/api'

export type LinkrunnerCampaignStats = {
  campaign_name: string
  clicks: number
  installs: number
  signups: number
}

async function linkrunnerFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    headers: {
      'linkrunner-key': process.env.LINKRUNNER_API_KEY!,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Linkrunner API error: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

// Parse a field that may be a formatted string ("3,201") or a raw number
function parseNum(v: any): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  return Number(String(v).replace(/[^0-9.-]/g, '')) || 0
}

function parseCampaign(c: any): LinkrunnerCampaignStats {
  return {
    campaign_name: (c.name ?? '').toLowerCase().trim(),
    clicks:        parseNum(c.clicks),
    installs:      parseNum(c.installs),
    signups:       parseNum(c['sign-ups'] ?? c.signups ?? 0),
  }
}

const wait = (s: number) => new Promise(r => setTimeout(r, s * 1000))

// Fetch campaigns → lowercase-name → stats map.
// IMPORTANT: the Reporting API rejects limit>100 (422), caps page size at 100, and
// rate-limits to 1 req/min. There are ~158 campaigns across 2 pages.
//
// Pass `expectedNames` (the campaign slugs you actually need) so we can short-circuit:
// page 1 is fetched first, and we only pay the 65s rate-limit wait to fetch page 2 if
// some expected names weren't on page 1. In the common case (all pilots on page 1) this
// is a single fast call. For campaign-mode creator slugs use getCampaignStatsBySearch().
export async function getAllCampaignStats(expectedNames?: string[]): Promise<Map<string, LinkrunnerCampaignStats>> {
  const map = new Map<string, LinkrunnerCampaignStats>()
  const want = new Set((expectedNames ?? []).map(n => n.toLowerCase().trim()))
  try {
    const res = await linkrunnerFetch('/v1/reporting/campaigns', { limit: '100', page: '1', start_date: LR_START_DATE, end_date: todayISO() })
    const campaigns: any[] = res?.data?.campaigns ?? []
    const totalPages: number = res?.data?.pagination?.pages ?? 1
    console.log(`[Linkrunner] page 1: ${campaigns.length} campaigns (totalPages=${totalPages})`)

    for (const c of campaigns) {
      const name = (c.name ?? '').toLowerCase().trim()
      if (name) map.set(name, parseCampaign(c))
    }

    // Determine if we still need later pages
    const stillMissing = () => [...want].filter(n => !map.has(n))
    const needMore = want.size === 0 ? false : stillMissing().length > 0

    if (needMore) {
      for (let p = 2; p <= totalPages; p++) {
        if (stillMissing().length === 0) break
        console.log(`[Linkrunner] missing ${stillMissing().join(', ')} — waiting 65s for page ${p}/${totalPages}`)
        await wait(65)
        const pageRes = await linkrunnerFetch('/v1/reporting/campaigns', { limit: '100', page: String(p), start_date: LR_START_DATE, end_date: todayISO() })
        const pageCampaigns: any[] = pageRes?.data?.campaigns ?? []
        for (const c of pageCampaigns) {
          const name = (c.name ?? '').toLowerCase().trim()
          if (name) map.set(name, parseCampaign(c))
        }
      }
    }
  } catch (err) {
    console.error('Linkrunner getAllCampaignStats failed:', err)
  }
  return map
}

// Earliest possible date for any campaign data — used as start_date in all API calls
// so Linkrunner returns cumulative stats, not just "today".
const LR_START_DATE = '2026-01-01'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Fetch campaigns matching a server-side search term in a single call.
// The Reporting API supports `search` which filters by campaign name (prefix/substring).
// e.g. getCampaignStatsBySearch('tdf') returns all tdf1…tdf10 creators in one request.
// Always passes start_date + end_date — without them LR defaults to today-only, which
// makes low-traffic campaigns appear to have 0 clicks/installs.
export async function getCampaignStatsBySearch(search: string): Promise<Map<string, LinkrunnerCampaignStats>> {
  const map = new Map<string, LinkrunnerCampaignStats>()
  try {
    const res = await linkrunnerFetch('/v1/reporting/campaigns', {
      limit: '100',
      search,
      start_date: LR_START_DATE,
      end_date:   todayISO(),
    })
    const campaigns: any[] = res?.data?.campaigns ?? []
    console.log(`[Linkrunner] search "${search}": ${campaigns.length} campaigns`)

    for (const c of campaigns) {
      const name = (c.name ?? '').toLowerCase().trim()
      if (name) map.set(name, parseCampaign(c))
    }
  } catch (err) {
    console.error(`Linkrunner getCampaignStatsBySearch("${search}") failed:`, err)
  }
  return map
}

// Single-campaign lookup
export async function getLinkrunnerStats(campaignName: string): Promise<LinkrunnerCampaignStats | null> {
  const all = await getAllCampaignStats()
  return all.get(campaignName.toLowerCase().trim()) ?? null
}
