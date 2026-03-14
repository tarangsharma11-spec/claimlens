-- ═══════════════════════════════════════════════════════════
-- CaseAssist Migration 003: Record Visibility (shared_with)
-- Run in Vercel Postgres / Neon SQL Editor
-- ═══════════════════════════════════════════════════════════

ALTER TABLE claims ADD COLUMN IF NOT EXISTS shared_with JSONB DEFAULT '[]'::jsonb;

-- GIN index for fast ? (contains) queries on shared_with
CREATE INDEX IF NOT EXISTS idx_claims_shared ON claims USING GIN (shared_with);
