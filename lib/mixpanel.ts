// Mixpanel API client
// Uses Service Account authentication against the JQL / Export API
// Requires: MIXPANEL_PROJECT_ID, MIXPANEL_SERVICE_ACCOUNT_USERNAME, MIXPANEL_SERVICE_ACCOUNT_SECRET

const PROJECT_ID = process.env.MIXPANEL_PROJECT_ID ?? '3969008'
const BASE_URL = 'https://mixpanel.com/api/2.0'

function getAuthHeader() {
  const username = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET

  if (!username || !secret) {
    return null // Mixpanel not yet configured
  }

  return 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64')
}

// Returns list of user distinct_ids + phone numbers for users attributed to a campaign
// who have fired the "First App Open" event
export async function getMixpanelInstalls(campaignName: string): Promise<{
  first_app_opens: number
  phone_numbers: string[]
}> {
  const authHeader = getAuthHeader()

  if (!authHeader) {
    console.warn('Mixpanel: Service account not configured yet. Returning 0.')
    return { first_app_opens: 0, phone_numbers: [] }
  }

  try {
    // Use JQL to get users who had First App Open attributed to this campaign
    const jqlScript = `
      function main() {
        return People()
          .filter(function(user) {
            return user.properties['attribution_campaign_name'] === '${campaignName}';
          })
          .map(function(user) {
            return {
              distinct_id: user.distinct_id,
              phone: user.properties['$phone'] || user.properties['phone_number'] || user.properties['Phone'] || null,
              had_first_open: user.properties['$last_seen'] !== undefined
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
      body: new URLSearchParams({
        project_id: PROJECT_ID,
        script: jqlScript,
      }),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`Mixpanel JQL error: ${res.status} ${await res.text()}`)
    }

    const users: any[] = await res.json()

    const phone_numbers = users
      .map((u: any) => u.phone)
      .filter((p: any): p is string => !!p && typeof p === 'string')

    return {
      first_app_opens: users.length,
      phone_numbers,
    }
  } catch (err) {
    console.error(`Mixpanel fetch failed for campaign "${campaignName}":`, err)
    return { first_app_opens: 0, phone_numbers: [] }
  }
}
