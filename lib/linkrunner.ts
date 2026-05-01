// Linkrunner Data API client
// Docs: https://docs.linkrunner.io/api-reference/data-apis

const BASE_URL = 'https://api.linkrunner.io'

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
    next: { revalidate: 0 }, // no cache - always fresh on cron
  })

  if (!res.ok) {
    throw new Error(`Linkrunner API error: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

export async function getLinkrunnerStats(
  campaignName: string,
  startDate?: string,
  endDate?: string
): Promise<LinkrunnerCampaignStats | null> {
  try {
    // Fetch all campaigns and filter by name
    const data = await linkrunnerFetch('/v1/campaigns', {
      ...(startDate && { start_date: startDate }),
      ...(endDate && { end_date: endDate }),
    })

    // The API returns a list of campaigns - find ours by name
    const campaigns: any[] = data?.data || data?.campaigns || []
    const campaign = campaigns.find(
      (c: any) =>
        c.name?.toLowerCase() === campaignName.toLowerCase() ||
        c.campaign_name?.toLowerCase() === campaignName.toLowerCase()
    )

    if (!campaign) {
      console.warn(`Linkrunner: campaign "${campaignName}" not found`)
      return null
    }

    return {
      campaign_name: campaignName,
      clicks: campaign.clicks ?? 0,
      installs: campaign.installs ?? 0,
      reinstalls: campaign.reinstalls ?? 0,
      signups: campaign.sign_ups ?? campaign.signups ?? 0,
      conversion_rate: parseFloat(campaign.conversion ?? campaign.conversion_rate ?? 0),
      retention_d1: parseFloat(campaign.rolling_retention_d1 ?? campaign.retention_d1 ?? 0),
      retention_d7: parseFloat(campaign.rolling_retention_d7 ?? campaign.retention_d7 ?? 0),
    }
  } catch (err) {
    console.error(`Linkrunner fetch failed for "${campaignName}":`, err)
    return null
  }
}
