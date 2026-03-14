-- ═══════════════════════════════════════════════════════════
-- CaseAssist Migration 004: Updated Plans + API Usage Tracking
-- Run in Neon SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Update plan CHECK constraint to support new tiers
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'));

-- Update any existing 'starter' plans to 'free', 'firm' to 'enterprise'
UPDATE organizations SET plan = 'free' WHERE plan = 'starter';
UPDATE organizations SET plan = 'enterprise' WHERE plan = 'firm';

-- API usage tracking for rate limiting
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'ai_analysis', 'opm_search', 'pdf_export'
  claim_id UUID,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_org_month ON api_usage(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_email, created_at);
