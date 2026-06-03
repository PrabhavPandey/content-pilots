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

// Fetch the first page of campaigns (limit=100, the API maximum) → lowercase-name → stats map.
// IMPORTANT: the Reporting API rejects limit>100 (422) and rate-limits to 1 req/min.
// Pilot campaigns are high-volume so they always appear on page 1 — a single page-1
// fetch covers all of them in one call without risking rate limits.
// For campaign-mode creator slugs (which may fall on later pages), use
// getCampaignStatsBySearch() instead — it filters server-side in one call.
export async function getAllCampaignStats(): Promise<Map<string, LinkrunnerCampaignStats>> {
  const map = new Map<string, LinkrunnerCampaignStats>()
  try {
    const res = await linkrunnerFetch('/v1/reporting/campaigns', { limit: '100', page: '1' })
    const campaigns: any[] = res?.data?.campaigns ?? []
    const pag = res?.data?.pagination
    console.log(`[Linkrunner] page 1: ${campaigns.length} campaigns (total=${pag?.total ?? '?'})`)

    for (const c of campaigns) {
      const name = (c.name ?? '').toLowerCase().trim()
      if (name) map.set(name, parseCampaign(c))
    }
  } catch (err) {
    console.error('Linkrunner getAllCampaignStats failed:', err)
  }
  return map
}

// Fetch campaigns matching a server-side search term in a single call.
// The Reporting API supports `search` which filters by campaign name (prefix/substring).
// e.g. getCampaignStatsBySearch('tdf') returns all tdf1…tdf10 creators in one request.
export async function getCampaignStatsBySearch(search: string): Promise<Map<string, LinkrunnerCampaignStats>> {
  const map = new Map<string, LinkrunnerCampaignStats>()
  try {
    const res = await linkrunnerFetch('/v1/reporting/campaigns', { limit: '100', search })
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
