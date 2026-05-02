-- ============================================================
-- Pilot Tracker - Gemini company classification cache
-- Run this in your Supabase SQL editor AFTER 001_init.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS company_classifications (
  company_name TEXT PRIMARY KEY, -- lowercase-trimmed company name
  is_startup    BOOLEAN NOT NULL,
  classified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by company_name (already covered by PK, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_company_classifications_name
  ON company_classifications(company_name);
