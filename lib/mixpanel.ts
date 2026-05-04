// Mixpanel API client
// Uses Service Account authentication against the JQL / Export API

const PROJECT_ID = process.env.MIXPANEL_PROJECT_ID ?? '3969008'
const BASE_URL = 'https://mixpanel.com/api/2.0'

function getAuthHeader() {
  const username = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET
  if (!username || !secret) return null
  return 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64')
}

export type MixpanelUser = {
  phone: string
  city: string | null
}

async function runJql(script: string): Promise<any[]> {
  const authHeader = getAuthHeader()
  if (!authHeader) {
    console.warn('Mixpanel: Service account not configured.')
    return []
  }

  const res = await fetch(`${BASE_URL}/jql/`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ project_id: PROJECT_ID, script }),
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Mixpanel JQL error: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

// Fetch users for ALL campaigns in a single JQL call.
// Returns a map of campaign_name → { first_app_opens, users }.
// This replaces calling getMixpanelInstalls once per pilot (6 calls → 1 call).
export async function getAllCampaignInstalls(
  campaignNames: string[]
): Promise<Map<string, { first_app_opens: number; users: MixpanelUser[] }>> {
  const resultMap = new Map<string, { first_app_opens: number; users: MixpanelUser[] }>()
  // Initialise empty buckets for every campaign
  for (const name of campaignNames) {
    resultMap.set(name, { first_app_opens: 0, users: [] })
  }

  if (campaignNames.length === 0) return resultMap

  try {
    const jqlScript = `
      function main() {
        var campaigns = ${JSON.stringify(campaignNames)};
        return People()
          .filter(function(user) {
            return campaigns.indexOf(user.properties['attribution_campaign_name']) !== -1;
          })
          .map(function(user) {
            return {
              campaign: user.properties['attribution_campaign_name'] || null,
              phone: user.properties['$phone']
                  || user.properties['phone_number']
                  || user.properties['Phone']
                  || null,
              city: user.properties['City']
                 || user.properties['city']
                 || user.properties['$city']
                 || null,
            };
          });
      }
    `

    const raw: any[] = await runJql(jqlScript)
    console.log(`Mixpanel: ${raw.length} total users across all campaigns`)

    for (const u of raw) {
      const campaign = u.campaign as string | null
      if (!campaign || !resultMap.has(campaign)) continue

      const bucket = resultMap.get(campaign)!
      bucket.first_app_opens++

      if (u.phone) {
        bucket.users.push({
          phone: String(u.phone).replace(/\D/g, '').slice(-10),
          city: u.city ?? null,
        })
      }
    }
  } catch (err) {
    console.error('Mixpanel getAllCampaignInstalls failed:', err)
  }

  return resultMap
}

// Single-campaign lookup kept for backwards compatibility / ad-hoc use
export async function getMixpanelInstalls(campaignName: string): Promise<{
  first_app_opens: number
  users: MixpanelUser[]
}> {
  try {
    const jqlScript = `
      function main() {
        return People()
          .filter(function(user) {
            return user.properties['attribution_campaign_name'] === '${campaignName}';
          })
          .map(function(user) {
            return {
              phone: user.properties['$phone']
                  || user.properties['phone_number']
                  || user.properties['Phone']
                  || null,
              city: user.properties['City']
                 || user.properties['city']
                 || user.properties['$city']
                 || null,
            };
          });
      }
    `
    const raw: any[] = await runJql(jqlScript)
    const users: MixpanelUser[] = raw
      .filter(u => u.phone)
      .map(u => ({
        phone: String(u.phone).replace(/\D/g, '').slice(-10),
        city: u.city ?? null,
      }))
    return { first_app_opens: raw.length, users }
  } catch (err) {
    console.error(`Mixpanel fetch failed for "${campaignName}":`, err)
    return { first_app_opens: 0, users: [] }
  }
}
