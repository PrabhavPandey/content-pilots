// Metabase API client - READ ONLY
// Question 498: "Tal Onboarded User Details + Company"
// Columns: Phone Number, Name, LinkedIn, Current Company, Onboarded At

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
    throw new Error(`Metabase API error ${res.status}: ${await res.text()}`)
  }

  return res.json()
}

function runRows(data: any): Record<string, any>[] {
  const rows: any[][] = data?.data?.rows ?? []
  const cols: { name: string }[] = data?.data?.cols ?? []
  return rows.map(row => Object.fromEntries(cols.map((col, i) => [col.name, row[i]])))
}

export type MetabaseUser = {
  phone: string
  name: string | null
  company: string | null
}

// Fetch all onboarded users from question 498
// Uses a 90-day lookback window to capture the full pilot period
export async function getOnboardedUsers(): Promise<MetabaseUser[]> {
  const today = new Date()
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const fmt = (d: Date) => d.toISOString().split('T')[0]

  try {
    const data = await metabaseFetch('/card/498/query', {
      method: 'POST',
      body: JSON.stringify({
        ignore_cache: true,
        parameters: [
          {
            type: 'date/single',
            value: fmt(ninetyDaysAgo),
            target: ['variable', ['template-tag', 'start_date']],
          },
          {
            type: 'date/single',
            value: fmt(today),
            target: ['variable', ['template-tag', 'end_date']],
          },
        ],
      }),
    })

    const rows = runRows(data)

    // Normalize column names - Metabase may use different casings
    return rows.map(row => {
      const phone =
        row['Phone Number'] ?? row['phone_number'] ?? row['phone'] ?? row['Phone'] ?? ''
      const name = row['Name'] ?? row['name'] ?? null
      const company =
        row['Current Company'] ?? row['current_company'] ?? row['company'] ?? null

      return {
        phone: String(phone).replace(/\D/g, '').slice(-10),
        name: name ? String(name) : null,
        company: company ? String(company).trim() : null,
      }
    }).filter(u => u.phone.length >= 8)

  } catch (err) {
    console.error('Metabase getOnboardedUsers failed:', err)
    return []
  }
}

// List all Metabase questions (helper endpoint, read-only)
export async function listMetabaseQuestions(): Promise<{ id: number; name: string }[]> {
  try {
    const data = await metabaseFetch('/card?f=all&page=0&page_size=100')
    return (data ?? []).map((q: any) => ({ id: q.id, name: q.name }))
  } catch (err) {
    console.error('Failed to list Metabase questions:', err)
    return []
  }
}
