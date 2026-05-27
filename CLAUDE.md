# Pilot Tracker — Claude Code Context

## What this is

Internal dashboard for tracking TAL's content marketing pilots (influencer + UGC campaigns). Shows campaign-level metrics (clicks, installs, sign-ups, onboarded users, qualified installs) with a daily growth chart per campaign. Admin-only view has financials, installer table, and charts. Pilot (agency) accounts see only their own campaign.

Deployed on Vercel. Daily sync runs via cron at midnight or manually via the "Run Sync" button on the dashboard.

---

## Tech stack

- **Next.js 16** (App Router, `force-dynamic` pages)
- **React 19** — client components where needed
- **Tailwind CSS v4** — utility classes only, no config file
- **Supabase** — Postgres via `@supabase/supabase-js` (service role for server, anon for auth checks)
- **next-auth v5 beta** — credentials + Supabase adapter
- **No charting library** — charts are raw SVG built in-house
- **TypeScript** throughout

---

## Project structure

```
app/
  dashboard/page.tsx        # main page — server component, fetches data
  api/
    cron/sync/route.ts      # daily sync endpoint (Linkrunner + Mixpanel + Metabase + Gemini)
    admin/trigger-sync/     # manual sync trigger (same logic, proxied from UI)
    auth/[...nextauth]/     # next-auth handler
    classify/               # ad-hoc Gemini classification endpoint
    debug/                  # various debug endpoints (metabase, installs, etc.)

components/
  DashboardAdminView.tsx    # admin layout wrapper — holds hideFinancials state
  PilotCard.tsx             # per-campaign card (metrics + chart + budget)
  InstallsChart.tsx         # SVG line chart: daily onboarded + qualified
  CumulativeSummary.tsx     # top-level overview with filters + funnel
  InstallerTable.tsx        # collapsible table of onboarded users per campaign
  SyncBadge.tsx             # "synced N minutes ago" badge
  RunSyncButton.tsx         # button that triggers manual sync
  CopyLinkBox.tsx           # pilot view: copy tracking link
  MetricTile.tsx            # generic metric tile component

lib/
  db.ts                     # Supabase client + all DB types + query functions
  pilot-config.ts           # static metadata per campaign (budget, views, videoCount, linkrunner URL)
  linkrunner.ts             # Linkrunner API client
  mixpanel.ts               # Mixpanel JQL client
  metabase.ts               # Metabase SQL client (TAL's internal Metabase)
  gemini.ts                 # Gemini classification + Supabase cache
  auth.ts                   # next-auth config
  sheets.ts                 # (unused/legacy)
```

---

## Database schema (Supabase)

### `pilots`
| column | type | notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | display name e.g. "Third Draft" |
| type | text | `'ugc'` or `'influencer'` |
| linkrunner_campaign_name | text | slug used in all API calls, lowercase |
| active | bool | only active pilots are fetched |

### `pilot_metrics`
One row inserted per sync run per pilot. Latest 2 rows fetched for each pilot (current + prev for delta display).

| column | notes |
|--------|-------|
| pilot_id, fetched_at | FK + timestamp |
| lr_clicks, lr_installs, lr_reinstalls, lr_signups | from Linkrunner |
| mp_first_app_opens | from Mixpanel |
| qualified_installs | computed during sync |
| click_to_install_rate, install_to_qualified_rate, lr_conversion_rate, lr_retention_d1/d7 | computed/stored |

### `pilot_installs`
Fully refreshed on every sync (delete + reinsert per pilot). One row per onboarded user.

| column | notes |
|--------|-------|
| pilot_id, synced_at | FK + timestamp |
| phone | 10-digit normalized |
| name, company, job_role, city, linkedin | from Metabase |
| onboarded_at | from Metabase (`tal.users.created_at`) |
| is_city_qualified | bool — Tier-1 cities only (influencer pilots) |
| is_company_qualified | bool — Gemini verdict |
| is_qualified | `is_city_qualified && is_company_qualified` |
| gemini_reason | Gemini's one-line explanation |

### `company_classifications`
Gemini result cache. Keyed by `"{company}|||{jobRole}|||{pilotType}"` stored in `company_name`. Never expires.

### `users` (next-auth)
| column | notes |
|--------|-------|
| username, role | `'admin'` or `'pilot'` |
| pilot_id | null for admins, FK for pilot accounts |

---

## Active campaigns (`lib/pilot-config.ts`)

| slug | type | budget (INR) | videos | views |
|------|------|-------------|--------|-------|
| eastern-monk | influencer | 1,77,000 | - | - |
| aarchi | influencer | 60,000 | 72 | 9,96,899 |
| yoursbossy | influencer | TBD | - | - |
| the-other | ugc | 2,88,500 | - | - |
| third-draft | ugc | 2,36,000 | 120 | 30,52,761 |

**DOT is excluded** — filtered in `getLatestMetrics()` in `lib/db.ts` via `.not('linkrunner_campaign_name', 'in', '(dot)')` and removed from `PILOT_META`. The Supabase row may still be `active = true` but it won't appear anywhere.

Views are updated manually from agency screenshots. Edit the `views` field in `PILOT_META` when agencies send new screenshots.

---

## Sync pipeline (`app/api/cron/sync/route.ts`)

Triggered by: Vercel Cron (midnight daily) or `GET /api/cron/sync?secret=CRON_SECRET`

Steps:
1. Fetch active pilots from Supabase
2. **Parallel**: Linkrunner (all campaigns, 1 call) + Mixpanel JQL (all campaigns, 1 call)
3. Collect all attributed phones from Mixpanel
4. **Metabase**: look up user profiles (name, company, job_role, linkedin, onboarded_at) by phone — batched in chunks of 500 to stay under the 2000-row API cap
5. **Gemini**: batch classify unique (company + job_role + pilot_type) combos — results cached in `company_classifications` forever
6. Per pilot: compute qualification flags, insert new `pilot_metrics` row, delete + reinsert `pilot_installs`

**API call budget per run:** 1 Linkrunner + 1 Mixpanel + N Metabase batches (N = ceil(phones/500)) + 0-M Gemini (M = uncached combos only)

---

## Key data sources

### Linkrunner
- `getAllCampaignStats()` — fetches all campaigns in one call, returns map of slug → `{ clicks, installs, signups }`
- Tracking links are in `PILOT_META[slug].linkrunnerUrl`

### Mixpanel
- `getAllCampaignInstalls(campaignNames[])` — single JQL call, returns map of slug → `{ first_app_opens, users: [{phone, city}] }`
- `PILOT_START_DATE = '2026-05-06'` in `lib/mixpanel.ts` — only users attributed from this date
- Attribution via `user.properties['attribution_campaign_name']`

### Metabase
- Runs native SQL against TAL's production DB (database ID 12)
- Queries `tal.users` joined with `tal.user_linkedin_data`
- `PILOT_START_DATE = '2026-05-01'` in `lib/metabase.ts` — kept earlier than Mixpanel's date as a buffer
- `PHONE_BATCH_SIZE = 500` — Metabase `/api/dataset` hard-caps at 2000 rows per call
- `onboarded_at` comes from `tal.users.created_at` (when the user signed up on TAL)

### Gemini
- Model: `gemini-3.1-flash-lite`
- Two qualification prompts: UGC (broader — white-collar, tech-adjacent) and Influencer (stricter — SWE/PM at startup or big tech only)
- Cache key: `"{company}|||{jobRole}|||{pilotType}"` — cached forever in Supabase
- City qualification (influencer only): Bangalore, Mumbai, Delhi, Gurgaon, Hyderabad, Pune

---

## Qualification logic

**UGC pilots:** `is_company_qualified` (Gemini) only — no city gate. Qualified = working professional at a real company, not IT outsourcing/govt/student.

**Influencer pilots:** `is_city_qualified AND is_company_qualified`. City must be Tier-1 (see above). Company must be a startup or global product/tech company, and role must be SWE or PM.

---

## Known bugs fixed

### PostgREST max_rows=1000
Supabase's default `max_rows` silently caps `.select()` at 1000 rows even if you call `.limit(5000)`. Fixed in `getAllPilotInstalls()` with a `.range(from, from+999)` pagination loop.

### Metabase 2000-row cap
`/api/dataset` hard-caps results at 2000 rows regardless of SQL LIMIT. Fixed by batching phones in groups of 500 so each call returns at most 500 rows.

### SVG hover coordinate alignment
`InstallsChart.tsx` uses `svg.createSVGPoint() + getScreenCTM().inverse()` for mouse → SVG coordinate conversion. Do NOT revert to `(clientX - rect.left) * (SVG_W / rect.width)` — that breaks when `preserveAspectRatio="meet"` causes the SVG content to not span the full element width.

---

## Component notes

### `InstallsChart.tsx`
- Input: `PilotInstall[]` — groups by `onboarded_at` date
- Two smooth lines: `#1A1A1A` (total onboarded), `#16A34A` (qualified)
- Catmull-Rom → cubic bezier smoothing (`smoothPath()`)
- `useId()` for per-instance unique gradient IDs (prevents conflicts with multiple charts)
- Returns `null` if fewer than 2 distinct dates
- Spacer div (height 38) below chart prevents layout shift when tooltip not visible
- Admin-only: only renders when `isAdmin && installs && installs.length > 0`

### `CumulativeSummary.tsx`
- Filters: by type (UGC/Influencer), by pilot name, by date range (onboarded_at)
- Views hero: compact format (e.g. "4.05M") with click-to-expand to exact number
- `PILOT_START = new Date('2026-05-06')` — used for "Day N" counter
- **No efficiency metrics at overview level** — cost/view and cost/qualified only appear on individual `PilotCard` in admin view. This is intentional: not all pilots have views data, so aggregating would be misleading.

### `DashboardAdminView.tsx`
- Owns the `hideFinancials` toggle state (localStorage-persisted)
- Passes `hideFinancials` down to `CumulativeSummary` and `PilotCard`
- Sections: Influencer pilots first, then UGC

### `InstallerTable.tsx`
- Collapsible, search + sort, click-to-detail popover via React portal
- `showPhone` prop: true for admin, false for pilot (agency) view
- Sorts by `is_qualified` desc by default

---

## Design system

All colors and fonts via CSS variables — never hardcode unless it's a chart-specific color.

| Variable | Usage |
|----------|-------|
| `var(--text-primary)` | main text |
| `var(--text-secondary)` | secondary text |
| `var(--text-muted)` | labels, captions |
| `var(--bg-card)` | card backgrounds |
| `var(--border)` | dividers, card borders |
| `var(--font-poppins)` | headings, numbers |
| `var(--font-inconsolata)` | labels, badges, monospace |

Chart-specific hardcoded colors:
- `#1A1A1A` — onboarded line
- `#16A34A` — qualified line
- `#EFECE8` — gridlines
- `#059669` — qualified accent (stat cards)

Card border-radius: `rounded-2xl`. Shadows: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`.

---

## Environment variables needed

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
CRON_SECRET              # protects /api/cron/sync
METABASE_URL             # https://metabase.pub.gcp.gvine.app
METABASE_API_KEY
MIXPANEL_PROJECT_ID      # 3969008
MIXPANEL_SERVICE_ACCOUNT_USERNAME
MIXPANEL_SERVICE_ACCOUNT_SECRET
GEMINI_API_KEY
LINKRUNNER_API_KEY
```

---

## Common tasks

**Add a new campaign:**
1. Add the pilot row to Supabase `pilots` table (active = true, correct type + slug)
2. Add an entry to `PILOT_META` in `lib/pilot-config.ts` with linkrunnerUrl and budget
3. Run sync

**Update views count** (from agency screenshots):
- Edit `views` in `PILOT_META` in `lib/pilot-config.ts`

**Exclude a pilot from the dashboard:**
- Set `active = false` in Supabase, OR
- Add slug to `EXCLUDED_SLUGS` in `getLatestMetrics()` in `lib/db.ts`

**Trigger a manual sync:**
- UI: click "Run Sync" on the dashboard
- API: `GET /api/cron/sync?secret=CRON_SECRET`

**Verify onboarded count:**
- Supabase SQL: `SELECT COUNT(*) FROM pilot_installs`
- Or: `SELECT pilot_id, COUNT(*) FROM pilot_installs GROUP BY pilot_id`

**Reset Gemini classification cache** (if prompts change):
- `DELETE FROM company_classifications` in Supabase SQL editor
- Or use `/api/debug/reset-company-cache`

---

## Git workflow

The sandbox can't write to `.git` — always commit from your own terminal:

```bash
# If there's a lock file:
rm -f .git/index.lock .git/HEAD.lock

git add <files>
git commit -m "..."
git push
```

Vercel auto-deploys on push to main.
