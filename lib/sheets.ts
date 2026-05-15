// Google Sheets reader for per-video view counts
// Each agency maintains their own sheet.
// Expected columns (any order, case-insensitive headers):
//   video_url | views  (minimum required)
//   Optional: title, date, likes, comments
//
// Auth: Google Sheets API v4 with a service account.
// Share each sheet with: GOOGLE_SERVICE_ACCOUNT_EMAIL (viewer access).

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

// Extract spreadsheet ID from a Google Sheets URL
export function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m?.[1] ?? null
}

// Get a short-lived access token from the service account credentials
async function getAccessToken(): Promise<string> {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!credentials) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')

  const sa = JSON.parse(credentials)

  const now  = Math.floor(Date.now() / 1000)
  const exp  = now + 3600

  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp,
  })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')

  const unsigned = `${header}.${payload}`

  // Sign with RSA-SHA256
  const key = await importPrivateKey(sa.private_key)
  const sig  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const b64  = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  const jwt  = `${unsigned}.${b64}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export type VideoRow = {
  title:    string | null
  url:      string | null
  views:    number
  date:     string | null
}

// Fetch all video rows from a sheet and return them + total views
export async function fetchSheetViews(sheetsUrl: string): Promise<{ rows: VideoRow[]; total: number }> {
  const sheetId = extractSheetId(sheetsUrl)
  if (!sheetId) return { rows: [], total: 0 }

  try {
    const token = await getAccessToken()

    // Read first sheet, first 500 rows
    const res = await fetch(
      `${SHEETS_API}/${sheetId}/values/A1:Z500?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )

    if (!res.ok) {
      console.error(`Sheets fetch failed for ${sheetId}: ${res.status}`)
      return { rows: [], total: 0 }
    }

    const data = await res.json()
    const raw: string[][] = data.values ?? []
    if (raw.length < 2) return { rows: [], total: 0 }

    // Normalise headers
    const headers = raw[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'))
    const col = (name: string) => headers.indexOf(name)

    const viIdx    = col('views') >= 0 ? col('views') : col('view_count') >= 0 ? col('view_count') : -1
    const urlIdx   = col('video_url') >= 0 ? col('video_url') : col('url') >= 0 ? col('url') : col('link') >= 0 ? col('link') : -1
    const titleIdx = col('title') >= 0 ? col('title') : col('video_title') >= 0 ? col('video_title') : -1
    const dateIdx  = col('date') >= 0 ? col('date') : col('published') >= 0 ? col('published') : -1

    if (viIdx < 0) {
      console.warn(`No "views" column found in sheet ${sheetId}. Headers: ${headers.join(', ')}`)
      return { rows: [], total: 0 }
    }

    const rows: VideoRow[] = []
    let total = 0

    for (const row of raw.slice(1)) {
      const rawViews = row[viIdx]?.replace(/,/g, '').trim()
      const views    = parseInt(rawViews ?? '0', 10)
      if (isNaN(views)) continue

      total += views
      rows.push({
        title: titleIdx >= 0 ? (row[titleIdx] ?? null) : null,
        url:   urlIdx   >= 0 ? (row[urlIdx]   ?? null) : null,
        views,
        date:  dateIdx  >= 0 ? (row[dateIdx]  ?? null) : null,
      })
    }

    return { rows, total }
  } catch (err) {
    console.error(`fetchSheetViews failed for ${sheetsUrl}:`, err)
    return { rows: [], total: 0 }
  }
}
