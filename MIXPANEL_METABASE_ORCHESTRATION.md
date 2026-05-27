# Mixpanel + Metabase Orchestration — How It Works

Context: this was built for a content pilot tracker at TAL (Grapevine). The same pattern applies to any setup where you need to **join behavioral data (Mixpanel) with internal database records (Metabase)** — including finance use cases querying a Round1 God table or any other internal Metabase DB.

---

## The Core Pattern

Mixpanel tracks events and stores user profiles with `$phone` as the identity. Metabase sits on top of your internal Postgres DB and can run raw SQL via an API. The orchestration links them:

```
Mixpanel (who did what + their phone number)
    ↓
Collect all attributed phones
    ↓
Metabase (look up those phones in your internal DB → get full profiles)
    ↓
Your app (join the two datasets, write to Supabase/wherever)
```

---

## 1. Mixpanel — JQL API

Mixpanel's **JQL (JavaScript Query Language)** API runs queries against People profiles. You call it with a JS script as a string.

**Auth:** Service Account (username + secret), passed as HTTP Basic.

**Endpoint:** `POST https://mixpanel.com/api/2.0/jql/`

**Body:** `application/x-www-form-urlencoded` with `project_id` and `script`.

```typescript
const res = await fetch('https://mixpanel.com/api/2.0/jql/', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from(`${username}:${secret}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ project_id: PROJECT_ID, script }),
})
```

**The JQL script** — runs inside Mixpanel's JS sandbox:

```javascript
function main() {
  var campaigns = ["aarchi", "third-draft", "dot"];  // whatever you're filtering by

  return People()
    .filter(function(user) {
      return campaigns.indexOf(user.properties['attribution_campaign_name']) !== -1;
    })
    .map(function(user) {
      return {
        campaign: user.properties['attribution_campaign_name'] || null,
        phone: user.properties['$phone']
            || user.properties['phone_number']
            || null,
        city: user.properties['$city'] || null,
      };
    });
}
```

Returns a JSON array. No inherent row limit — returns everything that matches.

**Key gotcha:** phone properties vary by how they were set. Try `$phone`, `phone_number`, `Phone` (Mixpanel stores them case-sensitively).

---

## 2. Metabase — Native SQL via `/api/dataset`

Metabase exposes a REST endpoint that runs raw SQL against any connected database.

**Auth:** API key passed as `X-API-KEY` header. Generate from Metabase Admin → API Keys.

**Endpoint:** `POST https://your-metabase.com/api/dataset`

**Body:**
```json
{
  "database": 12,
  "type": "native",
  "native": {
    "query": "SELECT ... FROM tal.users WHERE ..."
  }
}
```

**Response shape:**
```json
{
  "data": {
    "cols": [{ "name": "phone" }, { "name": "user_name" }, ...],
    "rows": [["9876543210", "Prabhav", ...], ...]
  }
}
```

Parse it like this:

```typescript
function runRows(data: any): Record<string, any>[] {
  const rows: any[][] = data?.data?.rows ?? []
  const cols: { name: string }[] = data?.data?.cols ?? []
  return rows.map(row => Object.fromEntries(cols.map((col, i) => [col.name, row[i]])))
}
```

### Critical gotcha: Metabase hard-caps at 2,000 rows per API call

**This is enforced at the API level, not just the SQL level.** Even if you write `LIMIT 10000` in your SQL, Metabase will return at most 2,000 rows. This is a known Metabase behavior and there's no config to override it on the query API.

**Fix: batch your phone lookups.** Send 500 phones per call — each batch returns ≤500 rows, well under the 2,000 cap:

```typescript
const BATCH_SIZE = 500

export async function getOnboardedUsers(phones: string[]): Promise<User[]> {
  const unique = [...new Set(phones)]
  const results: User[] = []

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    const phoneList = batch.map(p => `'${p}'`).join(', ')

    const query = `
      SELECT u.phone, u.name, ...
      FROM your_schema.users u
      WHERE RIGHT(u.phone::text, 10) IN (${phoneList})
        AND u.created_at >= '2026-05-01'
      LIMIT 2000
    `
    // call Metabase, push to results
  }

  return results
}
```

The `RIGHT(u.phone::text, 10) IN (...)` pattern handles phone numbers stored with country codes (e.g. `919876543210`) when you only have the 10-digit version.

---

## 3. Joining the Two Datasets

After both calls, you have:
- Mixpanel → phone + campaign attribution + city
- Metabase → phone + full user profile (name, company, job role, LinkedIn, etc.)

Join on phone:

```typescript
// 1. Collect all phones from Mixpanel
const allPhones = new Set<string>()
for (const [campaign, data] of mpMap.entries()) {
  data.users.forEach(u => { if (u.phone) allPhones.add(u.phone) })
}

// 2. Bulk fetch profiles from Metabase
const metabaseUsers = await getOnboardedUsers([...allPhones])

// 3. Build a lookup map
const phoneToProfile = new Map<string, UserProfile>()
for (const u of metabaseUsers) {
  phoneToProfile.set(u.phone, u)
}

// 4. Per-campaign: enrich each user
for (const mpUser of campaign.users) {
  const profile = phoneToProfile.get(mpUser.phone)
  // profile has company, job_role, linkedin, etc.
}
```

---

## 4. Adapting for a Round1 God Table

The pattern is identical. The only things that change are:

**a) The Metabase query** — swap the JOIN/WHERE for whatever columns your table has:

```sql
SELECT
  r.phone,
  r.investor_name,
  r.round_amount,
  r.round_stage,
  r.company_name,
  r.closed_at
FROM finance.round1_god r
WHERE r.phone IN (${phoneList})
  AND r.closed_at >= '2026-01-01'
LIMIT 2000
```

**b) The identity field** — if your finance table uses email instead of phone as the key, swap it. The Mixpanel JQL script would return `user.properties['$email']` instead of `$phone`, and the Metabase query uses `WHERE email IN (...)`.

**c) The join key** — update `phoneToProfile` to `emailToProfile` or whatever the shared key is.

Everything else (batching, response parsing, writing to Supabase) stays the same.

---

## 5. The Full Sync Orchestration (summary)

```
1. Fetch all campaign names from your DB

2. In parallel:
   - Linkrunner/attribution tool → click/install metrics per campaign
   - Mixpanel JQL → all attributed users (phone + city) per campaign

3. Collect all phones into a single Set (deduped across campaigns)

4. Metabase batch lookup → phone → full profile
   (500 phones per call to stay under 2,000 row API cap)

5. Build phoneToProfile map

6. Per campaign, per user:
   - Look up their profile
   - Run your qualification logic (Gemini, rule-based, whatever)
   - Write to Supabase

7. Return summary JSON
```

---

## Environment Variables Needed

```
METABASE_URL=https://your-metabase-instance.com
METABASE_API_KEY=mb_xxxxxxxxxxxx
METABASE_DB_ID=12                          # find in Metabase Admin → Databases

MIXPANEL_PROJECT_ID=3969008
MIXPANEL_SERVICE_ACCOUNT_USERNAME=xxx
MIXPANEL_SERVICE_ACCOUNT_SECRET=xxx
```

Metabase DB ID: visible in the URL when you're on Admin → Databases → click a database (`/admin/databases/12`).

Mixpanel Service Account: Settings → Service Accounts → Create. Needs at least Project Analyst role.

---

## Files in This Repo to Reference

- `lib/mixpanel.ts` — full JQL implementation, handles multi-campaign in one query
- `lib/metabase.ts` — batched phone lookup with the 500/call pattern
- `app/api/cron/sync/route.ts` — full orchestration showing how everything connects
