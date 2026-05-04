// Linkrunner Data API client
// Docs: https://docs.linkrunner.io/api-reference/data-apis
// Base URL confirmed: https://api.linkrunner.io/api/v1/...

const BASE_URL = 'https://api.linkrunner.io/api'

export type LinkrunnerCampaignStats = {
  campaign_name: string
  clicks: number
  installs: number
  reinstalls: number
  signups: number
  conversion_rate: number
  retention_d1: number
  retention_d7: number
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

function parseCampaign(c: any, nameOverride?: string): LinkrunnerCampaignStats {
  // `attributed_users` may be a count (number) or array - handle both
  const attributed = Array.isArray(c.attributed_users)
    ? c.attributed_users.length
    : (typeof c.attributed_users === 'number' ? c.attributed_users : null)

  return {
    campaign_name: nameOverride ?? c.name ?? c.campaign_name ?? '',
    clicks:          c.clicks ?? c.total_clicks ?? c.click_count ?? 0,
    installs:        c.installs ?? c.total_installs ?? attributed ?? 0,
    reinstalls:      c.reinstalls ?? 0,
    signups:         c.sign_ups ?? c.signups ?? 0,
    conversion_rate: parseFloat(c.conversion ?? c.conversion_rate ?? 0),
    retention_d1:    parseFloat(c.rolling_retention_d1 ?? c.retention_d1 ?? 0),
    retention_d7:    parseFloat(c.rolling_retention_d7 ?? c.retention_d7 ?? 0),
  }
}

// Fetch all campaigns in ONE API call and return a name → stats map.
export async function getAllCampaignStats(): Promise<Map<string, LinkrunnerCampaignStats>> {
  const map = new Map<string, LinkrunnerCampaignStats>()
  try {
    const data = await linkrunnerFetch('/v1/campaigns')
    const campaigns: any[] = data?.data || data?.campaigns || data || []

    if (campaigns.length > 0) {
      // Full first-item dump so we can see exact field names in Vercel logs
      console.log('[Linkrunner] campaigns count:', campaigns.length)
      console.log('[Linkrunner] first campaign raw:', JSON.stringify(campaigns[0]))
    } else {
      console.warn('[Linkrunner] no campaigns returned. Full raw response:', JSON.stringify(data).slice(0, 500))
    }

    for (const c of campaigns) {
      const name = (c.name ?? c.campaign_name ?? '').toLowerCase().trim()
      if (name) map.set(name, parseCampaign(c, name))
    }
  } catch (err) {
    console.error('Linkrunner getAllCampaignStats failed:', err)
  }
  return map
}

// Single-campaign lookup kept for backwards compatibility / ad-hoc use
export async function getLinkrunnerStats(campaignName: string): Promise<LinkrunnerCampaignStats | null> {
  const all = await getAllCampaignStats()
  return all.get(campaignName.toLowerCase().trim()) ?? null
}
