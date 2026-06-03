-- Campaign mode tables
-- Run this in Supabase SQL editor

-- Per-sync metrics aggregated at campaign level (tdf, aarchi)
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug  text NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  lr_clicks      int NOT NULL DEFAULT 0,
  lr_installs    int NOT NULL DEFAULT 0,
  lr_signups     int NOT NULL DEFAULT 0,
  mp_first_app_opens int NOT NULL DEFAULT 0,
  qualified_installs int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS campaign_metrics_slug_time ON campaign_metrics(campaign_slug, fetched_at DESC);

-- Per-sync metrics at creator level (tdf1…tdf10)
CREATE TABLE IF NOT EXISTS creator_metrics (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug  text NOT NULL,
  creator_slug   text NOT NULL,
  creator_label  text NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  lr_clicks      int NOT NULL DEFAULT 0,
  lr_installs    int NOT NULL DEFAULT 0,
  lr_signups     int NOT NULL DEFAULT 0,
  mp_first_app_opens int NOT NULL DEFAULT 0,
  qualified_installs int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS creator_metrics_slug_time ON creator_metrics(campaign_slug, creator_slug, fetched_at DESC);

-- One row per onboarded user — refreshed on every sync (delete + reinsert per campaign)
CREATE TABLE IF NOT EXISTS campaign_installs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_slug  text NOT NULL,
  creator_slug   text NOT NULL,
  creator_label  text NOT NULL,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  phone          text,
  name           text,
  company        text,
  job_role       text,
  city           text,
  linkedin       text,
  onboarded_at   timestamptz,
  is_city_qualified    bool NOT NULL DEFAULT false,
  is_company_qualified bool NOT NULL DEFAULT false,
  is_qualified         bool NOT NULL DEFAULT false,
  gemini_reason        text
);
CREATE INDEX IF NOT EXISTS campaign_installs_campaign ON campaign_installs(campaign_slug, onboarded_at);
CREATE INDEX IF NOT EXISTS campaign_installs_creator  ON campaign_installs(creator_slug, onboarded_at);
