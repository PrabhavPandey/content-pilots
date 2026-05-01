# TAL Pilot Tracker - Setup Guide

## Step 1: Run the Supabase schema

Go to your Supabase project → SQL Editor → paste and run the contents of:
`supabase/migrations/001_init.sql`

Then paste and run this SQL to create all users:

```sql
INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('prabhav', '$2b$12$lsc3sV8/0TxPGFYmY1VaxOsY9TxX.G41PYBCg687ZPrKRI9wKOTrS', 'admin', NULL);
INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('the-other', '$2b$12$Io/qz2/UQfb7NbQDwaAuj.OW8H0yaRW4LlgDezUSd.jwdpfCJiKaK', 'pilot', 'the-other');
INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('third-draft', '$2b$12$oJOz7.AKzMyeptp.S.u9LuL.O9.PPLLT/7kycuiNa7F6F0GNHSMAu', 'pilot', 'third-draft');
INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('dot-ugc', '$2b$12$Q5wAUOsRmk/mYcbpF.stG.4g.S8D.05i6hLpHRsqnqq0pQYJeMF6W', 'pilot', 'dot');
INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('yoursbossy', '$2b$12$5gtrb/nVnogHwoo5t0KxqOaisA44EOEa2lPrANRb11ahkyJwhj01q', 'pilot', 'yoursbossy');
INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('aarchi', '$2b$12$6tz9zvbDHQg/tonSaIfbp.ZUkP6KF4EIq5KcR84BNVMf45luizn4C', 'pilot', 'aarchi');
INSERT INTO users (username, password_hash, role, pilot_id) VALUES ('eastern-monk', '$2b$12$KEZw5Tlnq8KE.iAogNZpFeewsJ1UEnc6NjZvWBDkw9TlgJTRhOS6O', 'pilot', 'eastern-monk');
```

## Step 2: Create Linkrunner campaigns

In Linkrunner, create 6 campaigns with EXACTLY these names (case-sensitive):
- `the-other`
- `third-draft`
- `dot`
- `yoursbossy`
- `aarchi`
- `eastern-monk`

Give each creator/agency their Linkrunner short link.

## Step 3: Configure environment variables

Copy `.env.example` to `.env.local` and fill in:
- `SUPABASE_ANON_KEY` - from Supabase → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` - from Supabase → Settings → API
- `NEXTAUTH_SECRET` - run: `openssl rand -base64 32`
- `CRON_SECRET` - run: `openssl rand -base64 32`
- `MIXPANEL_SERVICE_ACCOUNT_USERNAME` + `MIXPANEL_SERVICE_ACCOUNT_SECRET` - ask Mixpanel admin
- `METABASE_QUALIFIED_QUESTION_ID` - see Step 4

## Step 4: Find the Metabase question ID

After deploying, hit this endpoint once:
```
GET https://your-domain.vercel.app/api/metabase-questions?secret=YOUR_CRON_SECRET
```
Find the question that has qualified install data (with phone numbers + city + job function).
Add its ID as `METABASE_QUALIFIED_QUESTION_ID` in your Vercel env vars.

## Step 5: Deploy to Vercel

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/PrabhavPandey/content-pilots.git
git push -u origin main
```

Then in Vercel:
1. Import the GitHub repo
2. Add all environment variables from `.env.local`
3. Set `NEXTAUTH_URL` to your Vercel domain (e.g. `https://content-pilots.vercel.app`)
4. Deploy

## Step 6: Trigger first sync

Hit the cron endpoint manually to populate data immediately:
```
GET https://your-domain.vercel.app/api/cron/sync?secret=YOUR_CRON_SECRET
```

After that, it auto-runs every 12 hours.

---

## Credentials

| Who | Username | Password | Role |
|-----|----------|----------|------|
| Prabhav (you) | prabhav | UjGjmEF3PJpj | Admin - sees all pilots |
| The Other | the-other | CehwehnubTkh | Pilot - sees own only |
| Third Draft | third-draft | WKj6wZkxTN6e | Pilot - sees own only |
| DOT | dot-ugc | rYKeCGQ7krAd | Pilot - sees own only |
| Yoursbossy | yoursbossy | NADRFcy4j7ZA | Pilot - sees own only |
| Aarchi | aarchi | qTxXtn8MWcB4 | Pilot - sees own only |
| Eastern Monk | eastern-monk | MZfjqxvt6VFZ | Pilot - sees own only |

**Keep this file private. Do not commit it to a public repo.**
