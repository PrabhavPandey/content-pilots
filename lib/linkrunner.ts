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

// Fetch ALL campaigns from the Reporting API and return a lowercase-name → stats map.
// Rate limit is 1 req/min so we fetch pages sequentially. In practice all 6 pilot
// campaigns fit on page 1 (limit=100).
export async function getAllCampaignStats(): Promise<Map<string, LinkrunnerCampaignStats>> {
  const map = new Map<string, LinkrunnerCampaignStats>()
  try {
    // Use limit=500 to fetch all campaigns in a single call — avoids hitting the
    // 1 req/min rate limit that triggers when paginating across multiple requests.
    const first = await linkrunnerFetch('/v1/reporting/campaigns', { limit: '500' })
    const page1: any[] = first?.data?.campaigns ?? []
    const totalPages: number = first?.data?.pagination?.pages ?? 1

    console.log(`[Linkrunner] reporting page 1/${totalPages}, ${page1.length} campaigns (limit=500)`)

    for (const c of page1) {
      const name = (c.name ?? '').toLowerCase().trim()
      if (name) map.set(name, parseCampaign(c))
    }

    // Only paginate if there are somehow more than 500 campaigns
    for (let p = 2; p <= totalPages; p++) {
      const page = await linkrunnerFetch('/v1/reporting/campaigns', { limit: '500', page: String(p) })
      const campaigns: any[] = page?.data?.campaigns ?? []
      for (const c of campaigns) {
        const name = (c.name ?? '').toLowerCase().trim()
        if (name) map.set(name, parseCampaign(c))
      }
    }

    console.log(`[Linkrunner] loaded ${map.size} campaigns with clicks+installs+signups`)
  } catch (err) {
    console.error('Linkrunner getAllCampaignStats failed:', err)
  }
  return map
}

// Single-campaign lookup
export async function getLinkrunnerStats(campaignName: string): Promise<LinkrunnerCampaignStats | null> {
  const all = await getAllCampaignStats()
  return all.get(campaignName.toLowerCase().trim()) ?? null
}
