// Metabase API client
// Used to fetch qualified install data and match against phone numbers from Mixpanel
// Auth: API key in X-API-KEY header (imlewc/metabase-server MCP format)

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY = process.env.METABASE_API_KEY ?? ''

async function metabaseFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'X-API-KEY': API_KEY,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Metabase API error: ${res.status} ${await res.text()}`)
  }

  return res.json()
}

// Run a Metabase question/card by ID and return rows
export async function runMetabaseQuestion(questionId: number): Promise<any[]> {
  try {
    const data = await metabaseFetch(`/card/${questionId}/query`, {
      method: 'POST',
      body: JSON.stringify({ ignore_cache: true }),
    })

    const rows: any[][] = data?.data?.rows ?? []
    const cols: { name: string }[] = data?.data?.cols ?? []

    // Convert row arrays to objects using column names
    return rows.map(row =>
      Object.fromEntries(cols.map((col, i) => [col.name, row[i]]))
    )
  } catch (err) {
    console.error(`Metabase question ${questionId} failed:`, err)
    return []
  }
}

// Cross-reference phone numbers from Mixpanel with Metabase qualified install data
// Returns the count of phone numbers that appear in the qualified installs list
export async function getQualifiedInstalls(
  phoneNumbers: string[],
  qualifiedInstallsQuestionId: number
): Promise<number> {
  if (phoneNumbers.length === 0) {
    // If Mixpanel isn't configured yet, try fetching total qualified count from Metabase
    // and fall back to 0
    return 0
  }

  try {
    const qualifiedUsers = await runMetabaseQuestion(qualifiedInstallsQuestionId)

    // Normalize phone numbers for comparison
    const normalize = (p: string) => p.replace(/\D/g, '').slice(-10)
    const mixpanelSet = new Set(phoneNumbers.map(normalize))

    // Look for phone number column (common column names)
    const PHONE_COLS = ['phone', 'phone_number', 'mobile', 'Phone', 'Phone Number', 'mobile_number']

    let matched = 0
    for (const row of qualifiedUsers) {
      const phoneVal = PHONE_COLS.map(c => row[c]).find(v => v != null)
      if (phoneVal) {
        const normalized = normalize(String(phoneVal))
        if (mixpanelSet.has(normalized)) matched++
      }
    }

    return matched
  } catch (err) {
    console.error('Metabase qualified install matching failed:', err)
    return 0
  }
}

// Fetch all available questions in Metabase (useful for finding the right question ID)
export async function listMetabaseQuestions(): Promise<{ id: number; name: string }[]> {
  try {
    const data = await metabaseFetch('/card?f=all&page=0&page_size=100')
    return (data ?? []).map((q: any) => ({ id: q.id, name: q.name }))
  } catch (err) {
    console.error('Failed to list Metabase questions:', err)
    return []
  }
}
