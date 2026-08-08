-- Buildy hosted identity and commercial access boundary for Supabase/Postgres.
-- Apply only in the BStudioB-owned project after reviewing retention and billing policy.
CREATE TABLE IF NOT EXISTS buildy_accounts (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_user_id text UNIQUE,
  github_login text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS buildy_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES buildy_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'github_marketplace')),
  provider_reference text NOT NULL,
  plan text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_reference)
);
CREATE TABLE IF NOT EXISTS buildy_project_members (
  project_id text NOT NULL,
  account_id uuid NOT NULL REFERENCES buildy_accounts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, account_id)
);
ALTER TABLE buildy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildy_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildy_project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS buildy_accounts_self ON buildy_accounts FOR SELECT USING (id = auth.uid());
CREATE POLICY IF NOT EXISTS buildy_entitlements_self ON buildy_entitlements FOR SELECT USING (account_id = auth.uid());
CREATE POLICY IF NOT EXISTS buildy_project_members_self ON buildy_project_members FOR SELECT USING (account_id = auth.uid());
