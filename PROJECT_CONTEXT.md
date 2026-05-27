# Pilot Tracker - Project Context

## What It Is

A Next.js (App Router) dashboard for tracking Grapevine's influencer + UGC pilot campaigns. It shows how many people clicked → installed → onboarded → qualified for each campaign, with profile data (company, role, city, LinkedIn) pulled from internal systems.

**Live at:** Vercel deployment (auto-deploys from main branch)

---

## Tech Stack

- **Next.js 14 App Router** - server components for data fetching, client components for interactivity
- **Supabase** - Postgres, used as the main DB for pilots, metrics, installs
- **Vercel Cron** - daily sync at midnight, also manually triggerable
- **Auth** - simple username/password via Supabase auth, two roles: `admin` and `pilot`

---

## Data Flow (Sync Pipeline)

Every sync (`/api/cron/sync`) runs these steps in sequence:

```
1. Linkrunner API   → clicks, installs, signups per campaign
2. Mixpanel JQL     → phone numbers of users attributed to each campaign (single batched call)
3. Metabase SQL     → look up those phones in tal.users + tal.user_linkedin_data (company, job_role, linkedin)
4. Gemini           → classify each (company, job_role) pair as qualified or not (cached in Supabase)
5. Supabase write   → upsert pilot_metrics + refresh pilot_installs (delete + insert)
```

Linkrunner + Mixpanel run in parallel. Gemini classifications are cached forever per (company + role + pilot_type) combo.

---

## External APIs

### Linkrunner
- Internal link tracking. One call fetches stats for all campaigns.
- `lib/linkrunner.ts` → `getAllCampaignStats()` returns `Map<campaignName, { clicks, installs, signups }>`

### Mixpanel JQL
- `POST https://mixpanel.com/api/2.0/jql/`
- Auth: Basic with service account username + secret
- Queries `People()` profiles filtered by `attribution_campaign_name`
- Returns phone numbers and city for each user
- Single call for all campaigns (batched JQL, not one call per pilot)
- `lib/mixpanel.ts` → `getAllCampaignInstalls(campaignNames[])`

### Metabase
- `POST https://metabase.pub.gcp.gvine.app/api/dataset`
- Auth: `X-API-KEY` header
- Database ID: `12` (tal main DB)
- Runs native SQL against `tal.users` + `tal.user_linkedin_data`
- **Hard cap: 2,000 rows per API call** (enforced server-side, SQL LIMIT is ignored)
- Fix: batch phones in chunks of 500 → each call returns ≤500 rows, never hits cap
- `lib/metabase.ts` → `getOnboardedUsers(phones[])` handles batching

### Gemini
- Used to classify whether a (company, job_role) combination counts as a "qualified" install
- Results cached in Supabase `company_classifications` table (key = company + role + pilot_type)
- `lib/gemini.ts` → `batchClassifyUsers()`

---

## Qualification Logic

A user is `is_qualified = true` when:
- **City qualified**: for influencer pilots, user must be in a metro city. UGC pilots skip city check.
- **Company qualified**: Gemini says the company+role combo is a target customer

Both must be true. Stored as `is_city_qualified`, `is_company_qualified`, `is_qualified` in `pilot_installs`.

---

## Key Bugs Fixed (important context)

### 1. PostgREST max_rows = 1000
Supabase's PostgREST server default caps all queries at 1,000 rows. `.limit(10000)` in the Supabase client is silently overridden. Fix: use `.range(from, from + PAGE - 1)` in a loop.
- File: `lib/db.ts` → `getAllPilotInstalls()`

### 2. Metabase API 2,000-row hard cap
`/api/dataset` caps results at 2,000 rows regardless of `LIMIT` in the SQL. Fix: batch phones in chunks of 500 (PHONE_BATCH_SIZE = 500), so each call returns ≤500 rows.
- File: `lib/metabase.ts` → `getOnboardedUsers()`

### 3. PILOT_START_DATE mismatch
Metabase query filters `u.created_at >= PILOT_START_DATE`. Was set to `2026-05-06` (when dashboard launched) but campaigns started May 2 - silently excluded early users. Fixed to `2026-05-01`.
- File: `lib/metabase.ts`

---

## Database Schema (Supabase)

```sql
pilots           -- id, name, type ('influencer'|'ugc'), linkrunner_campaign_name, active
pilot_metrics    -- id, pilot_id, fetched_at, lr_clicks, lr_installs, lr_signups, mp_first_app_opens, qualified_installs, ...
pilot_installs   -- id, pilot_id, synced_at, phone, name, company, job_role, city, linkedin, onboarded_at, is_city_qualified, is_company_qualified, is_qualified, gemini_reason
company_classifications -- key, qualified (bool), reason, pilot_type
users            -- id, username, role, pilot_id
```

Cross-check onboarded count: `SELECT COUNT(*) FROM pilot_installs` in Supabase.

---

## Campaign Config

Hardcoded in `lib/pilot-config.ts`:

```typescript
export const PILOT_META: Record<string, PilotMeta> = {
  'eastern-monk': { linkrunnerUrl: '...', budget: 177000 },
  'aarchi':       { linkrunnerUrl: '...', budget: 60000, videoCount: 72, views: 996899 },
  'yoursbossy':   { linkrunnerUrl: '...' },
  'dot':          { linkrunnerUrl: '...', budget: 283200, videoCount: 75 },
  'the-other':    { linkrunnerUrl: '...', budget: 288500 },
  'third-draft':  { linkrunnerUrl: '...', budget: 236000, videoCount: 120, views: 3052761 },
}
```

Views counts are updated manually from agency screenshots. Budget in INR, no paise.

---

## Dashboard UI

**Admin view** (`components/DashboardAdminView.tsx`) - client component, holds `hideFinancials` toggle state persisted in localStorage.

**CumulativeSummary** (`components/CumulativeSummary.tsx`) - overview cards:
- Views: compact format (`4.05M`) with click-to-expand for exact number
- Stats: Clicks, Installs, Onboarded, Qualified (with % of installs)
- Campaign context line: "Day N · 6 campaigns · since May 6, 2026"
- Funnel chart: Clicks → Installs → Sign-ups → Onboarded → Qualified
- Filter chips: Agency, Type, Date range
- No efficiency metrics (cost/view, cost/qualified) at overview level

**PilotCard** (`components/PilotCard.tsx`) - per-campaign card shows:
- Linkrunner funnel, Mixpanel opens, Onboarded, Qualified
- Views Generated (if `views` set and not hideFinancials)
- Budget + Cost/qualified metric (if budget set and not hideFinancials)

---

## Roles & Access

- `admin` - sees everything: all pilots, financials toggle, cumulative summary, trigger sync button
- `pilot` - sees only their own campaign card, no financials

---

## Environment Variables

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
METABASE_URL          # https://metabase.pub.gcp.gvine.app
METABASE_API_KEY
MIXPANEL_PROJECT_ID   # 3969008
MIXPANEL_SERVICE_ACCOUNT_USERNAME
MIXPANEL_SERVICE_ACCOUNT_SECRET
GEMINI_API_KEY
CRON_SECRET           # protects /api/cron/sync
LINKRUNNER_API_KEY
```

---

## Key Files

```
app/dashboard/page.tsx              -- server component, data fetching entry point
app/api/cron/sync/route.ts          -- main sync pipeline
components/DashboardAdminView.tsx   -- client wrapper, holds hideFinancials state
components/CumulativeSummary.tsx    -- overview stats + funnel
components/PilotCard.tsx            -- per-campaign card
lib/db.ts                           -- Supabase types + queries (with pagination fix)
lib/metabase.ts                     -- Metabase client (with batching fix)
lib/mixpanel.ts                     -- Mixpanel JQL client
lib/linkrunner.ts                   -- Linkrunner API client
lib/gemini.ts                       -- Gemini classification + cache
lib/pilot-config.ts                 -- campaign metadata (budget, views, linkrunner URLs)
```

---

## Common Tasks

**Re-run sync manually:**
Hit `/api/cron/sync?secret=CRON_SECRET` or use the "Run Sync" button on the dashboard.

**Update views for a campaign:**
Edit `views:` field in `lib/pilot-config.ts` → commit + push → redeploy.

**Add a new pilot:**
1. Insert row in `pilots` table in Supabase
2. Add entry to `PILOT_META` in `lib/pilot-config.ts`

**Git workflow note:**
Sandbox can't write git lock files. Always run from your own terminal:
```bash
rm -f .git/index.lock .git/HEAD.lock
git add -A && git commit -m "..." && git push
```
