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

// Returns users attributed to a campaign via attribution_campaign_name
// Fetches phone + city for each user
export async function getMixpanelInstalls(campaignName: string): Promise<{
  first_app_opens: number
  users: MixpanelUser[]
}> {
  const authHeader = getAuthHeader()

  if (!authHeader) {
    console.warn('Mixpanel: Service account not configured. Returning 0.')
    return { first_app_opens: 0, users: [] }
  }

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

    const res = await fetch(`${BASE_URL}/jql/`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ project_id: PROJECT_ID, script: jqlScript }),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`Mixpanel JQL error: ${res.status} ${await res.text()}`)
    }

    const raw: any[] = await res.json()

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
