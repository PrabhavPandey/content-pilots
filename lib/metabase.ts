// Metabase API client - READ ONLY
// Uses native SQL against database 12 (tal main db) to look up users by phone.
// Queries tal.users + tal.user_linkedin_data directly — no saved card dependency.
//
// NOTE: Metabase /api/dataset endpoint hard-caps results at 2000 rows per call.
// We work around this by batching phones in chunks of 500, so each call
// returns at most 500 rows and never hits the cap.

const BASE_URL = process.env.METABASE_URL ?? 'https://metabase.pub.gcp.gvine.app'
const API_KEY  = process.env.METABASE_API_KEY ?? ''
const DB_ID    = 12

// Earliest campaign start across all pilots — keep a buffer before this date
const PILOT_START_DATE = '2026-05-01'

// Metabase API caps results at 2000 rows. Batch size << 2000 guarantees we never hit it.
const PHONE_BATCH_SIZE = 500

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

async function fetchBatch(phones: string[]): Promise<MetabaseUser[]> {
  const phoneList = phones.map(p => `'${p}'`).join(', ')

  const query = `
    SELECT
      u.phone,
      u.name                                                      AS user_name,
      ld.current_company->>'name'                                 AS current_company_name,
      COALESCE(ld.current_company->>'title', ld.position)        AS job_role,
      ld.linkedin_url,
      ld.location,
      u.created_at
    FROM tal.users u
    LEFT JOIN tal.user_linkedin_data ld ON ld.user_phone = u.phone
    WHERE RIGHT(u.phone::text, 10) IN (${phoneList})
      AND u.created_at >= '${PILOT_START_DATE}'
    LIMIT 2000
  `

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
}

// Look up TAL user profiles for a specific set of phones (10-digit normalized).
// Batches in chunks of PHONE_BATCH_SIZE to stay under Metabase's 2000-row API cap.
export async function getOnboardedUsers(normalizedPhones: string[]): Promise<MetabaseUser[]> {
  if (normalizedPhones.length === 0) return []

  const phones = [...new Set(normalizedPhones)]
  const results: MetabaseUser[] = []

  for (let i = 0; i < phones.length; i += PHONE_BATCH_SIZE) {
    const batch = phones.slice(i, i + PHONE_BATCH_SIZE)
    try {
      const batchResult = await fetchBatch(batch)
      results.push(...batchResult)
    } catch (err) {
      console.error(`Metabase batch ${i}–${i + PHONE_BATCH_SIZE} failed:`, err)
    }
  }

  console.log(`Metabase: ${results.length} users from ${phones.length} phones (${Math.ceil(phones.length / PHONE_BATCH_SIZE)} batches)`)
  return results
}
