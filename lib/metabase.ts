// Metabase API client - READ ONLY
// Uses native SQL against database 12 (tal main db) to look up users by phone.
// Queries tal.users + tal.user_linkedin_data directly — no saved card dependency.

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY  = process.env.METABASE_API_KEY ?? ''
const DB_ID    = 12

function runRows(data: any): Record<string, any>[] {
  const rows: any[][] = data?.data?.rows ?? []
  const cols: { name: string }[] = data?.data?.cols ?? []
  return rows.map(row => Object.fromEntries(cols.map((col, i) => [col.name, row[i]])))
}

export type MetabaseUser = {
  phone: string
  name: string | null
  company: string | null
  job_role: string | null
  linkedin: string | null
  onboarded_at: string | null
}

// Look up TAL user profiles for a specific set of phones (10-digit normalized).
// The DB stores phones with country code (e.g. 919876543210), so we match on
// the last 10 digits using RIGHT(phone, 10).
// Returns only users who signed up on or after PILOT_START_DATE.
const PILOT_START_DATE = '2026-05-06'

export async function getOnboardedUsers(normalizedPhones: string[]): Promise<MetabaseUser[]> {
  if (normalizedPhones.length === 0) return []

  // Deduplicate
  const phones = [...new Set(normalizedPhones)]

  // Build SQL — match on last 10 digits so we handle any country code prefix
  const phoneList = phones.map(p => `'${p}'`).join(', ')

  const query = `
    SELECT
      u.phone,
      u.name                                                      AS user_name,
      ld.current_company->>'name'                                 AS current_company_name,
      COALESCE(ld.position, ld.current_company->>'title')        AS job_role,
      ld.linkedin_url,
      ld.location,
      u.created_at
    FROM tal.users u
    LEFT JOIN tal.user_linkedin_data ld ON ld.user_phone = u.phone
    WHERE RIGHT(u.phone::text, 10) IN (${phoneList})
      AND u.created_at >= '${PILOT_START_DATE}'
    LIMIT 2000
  `

  try {
    const res = await fetch(`${BASE_URL}/api/dataset`, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        database: DB_ID,
        type: 'native',
        native: { query },
      }),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      throw new Error(`Metabase dataset error ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    const rows = runRows(data)

    return rows.map(row => ({
      phone:        String(row['phone'] ?? '').replace(/\D/g, '').slice(-10),
      name:         row['user_name']           ? String(row['user_name']).trim()           : null,
      company:      row['current_company_name']? String(row['current_company_name']).trim(): null,
      job_role:     row['job_role']            ? String(row['job_role']).trim()            : null,
      linkedin:     row['linkedin_url']        ? String(row['linkedin_url']).trim()        : null,
      onboarded_at: row['created_at']          ? String(row['created_at'])                : null,
    })).filter(u => u.phone.length >= 8)

  } catch (err) {
    console.error('Metabase getOnboardedUsers failed:', err)
    return []
  }
}
