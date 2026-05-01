-- ============================================================
-- Pilot Tracker - Initial Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Users table (dashboard login accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pilot')),
  pilot_id TEXT, -- null for admin, slug for agencies e.g. 'the-other'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pilot config
CREATE TABLE IF NOT EXISTS pilots (
  id TEXT PRIMARY KEY, -- slug: 'the-other', 'third-draft', etc.
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('influencer', 'ugc')),
  linkrunner_campaign_name TEXT, -- matches attribution_campaign_name in Mixpanel
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics cache (refreshed every 12 hours by cron)
CREATE TABLE IF NOT EXISTS pilot_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id TEXT NOT NULL REFERENCES pilots(id) ON DELETE CASCADE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  -- Linkrunner metrics
  lr_clicks INTEGER DEFAULT 0,
  lr_installs INTEGER DEFAULT 0,
  lr_reinstalls INTEGER DEFAULT 0,
  lr_signups INTEGER DEFAULT 0,
  lr_conversion_rate DECIMAL(5,2) DEFAULT 0,
  lr_retention_d1 DECIMAL(5,2) DEFAULT 0,
  lr_retention_d7 DECIMAL(5,2) DEFAULT 0,

  -- Mixpanel metrics
  mp_first_app_opens INTEGER DEFAULT 0,

  -- Qualified installs (Metabase cross-referenced with Mixpanel by phone)
  qualified_installs INTEGER DEFAULT 0,

  -- Computed rates
  click_to_install_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN lr_clicks > 0 THEN ROUND((lr_installs::DECIMAL / lr_clicks) * 100, 2) ELSE 0 END
  ) STORED,
  install_to_qualified_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN lr_installs > 0 THEN ROUND((qualified_installs::DECIMAL / lr_installs) * 100, 2) ELSE 0 END
  ) STORED
);

-- Index for fast pilot lookups
CREATE INDEX IF NOT EXISTS idx_pilot_metrics_pilot_id ON pilot_metrics(pilot_id);
CREATE INDEX IF NOT EXISTS idx_pilot_metrics_fetched_at ON pilot_metrics(fetched_at DESC);

-- ============================================================
-- Seed: Pilots
-- ============================================================
INSERT INTO pilots (id, name, type, linkrunner_campaign_name) VALUES
  ('the-other',     'The Other',     'influencer', 'the-other'),
  ('third-draft',   'Third Draft',   'ugc',        'third-draft'),
  ('dot',           'DOT',           'ugc',        'dot'),
  ('yoursbossy',    'Yoursbossy',    'influencer', 'yoursbossy'),
  ('aarchi',        'Aarchi',        'ugc',        'aarchi'),
  ('eastern-monk',  'Eastern Monk',  'influencer', 'eastern-monk')
ON CONFLICT (id) DO NOTHING;
