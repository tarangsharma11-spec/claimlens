-- ═══════════════════════════════════════════════════════════
-- CaseAssist Multi-Tenancy Migration
-- Run in Vercel Postgres console: Dashboard → Storage → your db → Query
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══ ORGANIZATIONS ═══
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'firm')),
  billing_email TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_seats INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- ═══ MEMBERSHIPS ═══
-- Links users to orgs. One org per user enforced at app layer.
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT,
  role TEXT NOT NULL DEFAULT 'lawyer' CHECK (role IN ('lawyer', 'employer', 'adjudicator', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  invited_by TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_email)
);

-- Index for fast user → org lookups
CREATE INDEX IF NOT EXISTS idx_memberships_email ON memberships(user_email);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);

-- ═══ CLAIMS ═══
-- All existing claim fields + org scoping + assignment
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim_number TEXT NOT NULL,
  worker TEXT,
  employer TEXT,
  injury_date DATE,
  injury_type TEXT,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT, -- email of assigned user
  created_by TEXT NOT NULL,
  -- JSON fields for complex nested data (messages, timeline, etc.)
  documents JSONB DEFAULT '[]'::jsonb,
  analyses JSONB DEFAULT '[]'::jsonb,
  messages JSONB DEFAULT '[]'::jsonb,
  timeline JSONB DEFAULT '[]'::jsonb,
  notes JSONB DEFAULT '[]'::jsonb,
  comms JSONB DEFAULT '[]'::jsonb,
  emails JSONB DEFAULT '[]'::jsonb,
  tasks JSONB DEFAULT '[]'::jsonb,
  providers JSONB DEFAULT '[]'::jsonb,
  appeal JSONB DEFAULT '{}'::jsonb,
  three_point JSONB DEFAULT '{}'::jsonb,
  valuation JSONB DEFAULT '{}'::jsonb,
  modified_duties JSONB DEFAULT '[]'::jsonb,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_org ON claims(org_id);
CREATE INDEX IF NOT EXISTS idx_claims_assigned ON claims(assigned_to);
CREATE INDEX IF NOT EXISTS idx_claims_stage ON claims(org_id, stage);
CREATE INDEX IF NOT EXISTS idx_claims_number ON claims(org_id, claim_number);

-- ═══ ACTIVITY LOG ═══
-- Audit trail for everything that happens in an org
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'claim_created', 'analysis_run', 'stage_changed', etc.
  detail TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_claim ON activity_log(claim_id, created_at DESC);

-- ═══ UPDATE EXISTING USERS TABLE ═══
-- Add org_id to existing users table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- ═══ HELPER: Auto-update updated_at on claims ═══
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS claims_updated_at ON claims;
CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
