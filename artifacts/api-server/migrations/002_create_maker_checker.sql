-- Maker–Checker (Four-Eyes) Principle schema
--
-- Supports the approval workflow where a sensitive action is initiated by one
-- user (maker) and must be approved by a *different* authorized user (checker)
-- before it is applied. The person who initiates an action can never approve it
-- themselves — this is enforced both in the database (via a CHECK + trigger)
-- and in the API layer.

-- ── admin_audit_logs ─────────────────────────────────────────────────────────
-- Central audit trail for every sensitive admin action (maker + checker).
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_profile_id ON admin_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- ── sensitive_actions_config ────────────────────────────────────────────────
-- Configurable registry of which admin actions require maker-checker approval.
-- The Super Admin can toggle these and choose the required approver role.
CREATE TABLE IF NOT EXISTS sensitive_actions_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT NOT NULL UNIQUE,          -- e.g. "contributions.adjust"
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  approval_role TEXT DEFAULT 'super_admin',  -- role allowed to approve
  approval_level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed sensible defaults so the system is secure out of the box.
INSERT INTO sensitive_actions_config (action_key, display_name, description, category, requires_approval, approval_role)
VALUES
  ('contributions.adjust', 'Contribution Adjustment', 'Record or adjust a member contribution', 'contributions', true, 'super_admin'),
  ('loans.adjust', 'Loan Adjustment', 'Create or modify a loan record', 'loans', true, 'super_admin'),
  ('withdrawals.process', 'Withdrawal Processing', 'Process a member withdrawal', 'wallets', true, 'super_admin'),
  ('interest_rates.update', 'Interest Rate Update', 'Change interest rate configuration', 'accounting', true, 'super_admin')
ON CONFLICT (action_key) DO NOTHING;

-- ── approval_requests ────────────────────────────────────────────────────────
-- The actual maker-checker queue. One row per initiated-but-not-yet-applied
-- sensitive action.
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  request_type TEXT NOT NULL,                -- matches sensitive_actions_config.action_key
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal',   -- low | normal | high | critical

  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected | cancelled | expired | executed | failed
  approval_level INTEGER NOT NULL DEFAULT 1,

  -- Maker (initiator)
  initiated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  initiated_by_email TEXT,
  initiated_by_name TEXT,
  initiated_by_role TEXT,

  -- Checker (reviewer)
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by_email TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Target of the action
  target_type TEXT,
  target_id TEXT,
  action TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  notes TEXT,

  required_approvers TEXT[] DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  execution_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Four-eyes: the approver must differ from the initiator. Enforced as a hard
  -- CHECK so it cannot be bypassed, even with the service-role key.
  CONSTRAINT chk_four_eyes_approved CHECK (
    status <> 'approved' OR initiated_by IS NULL OR reviewed_by IS NULL OR initiated_by <> reviewed_by
  )
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_initiated_by ON approval_requests(initiated_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON approval_requests(created_at DESC);

-- Defensive trigger: also prevent a self-approval on UPDATE, and auto-stamp
-- updated_at. This is belt-and-braces alongside the application-layer guard.
CREATE OR REPLACE FUNCTION enforce_four_eyes_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved'
     AND NEW.initiated_by IS NOT NULL
     AND NEW.reviewed_by IS NOT NULL
     AND NEW.initiated_by = NEW.reviewed_by THEN
    RAISE EXCEPTION 'Four-eyes violation: the approver cannot be the same person who initiated the request.';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_four_eyes_approval ON approval_requests;
CREATE TRIGGER trg_four_eyes_approval
  BEFORE INSERT OR UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_four_eyes_approval();

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_actions_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- Service role (used by the API server) has full access to all three tables.
CREATE POLICY "service_all_admin_audit_logs"
  ON admin_audit_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_all_sensitive_actions_config"
  ON sensitive_actions_config FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_all_approval_requests"
  ON approval_requests FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated admins can read the approval queue and config (the API layer
-- enforces finer-grained role checks on top of this).
CREATE POLICY "authenticated_read_approval_requests"
  ON approval_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_sensitive_actions_config"
  ON sensitive_actions_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_read_admin_audit_logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (true);
