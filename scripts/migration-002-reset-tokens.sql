-- ═══════════════════════════════════════════════════════════
-- CaseAssist Migration 002: Password Reset Tokens
-- Run in Vercel Postgres console after migration-001
-- ═══════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;
