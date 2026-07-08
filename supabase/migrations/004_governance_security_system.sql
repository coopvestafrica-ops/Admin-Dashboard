-- ═══════════════════════════════════════════════════════════════════════════════
-- CoopVest Africa — Enterprise Governance & Security System
-- Implements: Super Admin Control, Approval Workflows, Audit Trail, Login Monitoring
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. ENHANCED ADMIN SESSIONS TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_token         text UNIQUE NOT NULL,
  device_info           jsonb DEFAULT '{}',
  ip_address            text,
  user_agent            text,
  operating_system      text,
  browser               text,
  device_type           text DEFAULT 'unknown',
  device_id             text,
  location_country      text,
  location_city         text,
  location_latitude     numeric,
  location_longitude    numeric,
  is_active             boolean DEFAULT true,
  is_locked             boolean DEFAULT false,
  lock_reason           text,
  locked_by             uuid REFERENCES public.profiles(id),
  locked_at             timestamptz,
  login_at              timestamptz DEFAULT now(),
  last_activity_at      timestamptz DEFAULT now(),
  logout_at             timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz DEFAULT now()
);

-- ── 2. ENHANCED AUDIT LOGS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id            uuid REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
  action                text NOT NULL,
  resource_type         text,
  resource_id           text,
  previous_value        jsonb,
  new_value             jsonb,
  details               jsonb DEFAULT '{}',
  
  -- Detailed actor information
  actor_email           text,
  actor_name            text,
  actor_role            text,
  actor_ip              text,
  actor_user_agent      text,
  actor_device_info     jsonb,
  actor_location        jsonb,
  actor_mfa_used        boolean DEFAULT false,
  actor_login_method    text,
  
  -- Approval information (for maker-checker)
  approval_id           uuid,
  approval_status       text CHECK (approval_status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by           uuid REFERENCES public.profiles(id),
  approved_at           timestamptz,
  approval_notes        text,
  
  -- Risk flags
  is_suspicious         boolean DEFAULT false,
  risk_flags            text[],
  risk_score            integer DEFAULT 0,
  
  -- Metadata
  status                text DEFAULT 'completed',
  error_message         text,
  created_at            timestamptz DEFAULT now()
);

-- ── 3. APPROVAL REQUESTS TABLE (Maker-Checker Pattern) ─────────────────────
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request details
  request_type          text NOT NULL,
  category              text NOT NULL,
  priority              text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status                text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  
  -- Who initiated
  initiated_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  initiated_by_email    text,
  initiated_by_name     text,
  initiated_by_role     text,
  
  -- Request payload
  target_type           text,
  target_id             text,
  action                text NOT NULL,
  previous_value        jsonb,
  new_value             jsonb,
  reason                text,
  notes                 text,
  
  -- Approval chain
  required_approvers    text[] DEFAULT '{}',
  current_approver_role text,
  approval_level        integer DEFAULT 1,
  
  -- Who approved/rejected
  reviewed_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_email    text,
  reviewed_at          timestamptz,
  review_notes         text,
  
  -- Expiration
  expires_at           timestamptz,
  
  -- Impact assessment
  financial_impact     numeric DEFAULT 0,
  affected_users       integer DEFAULT 0,
  
  -- Metadata
  metadata             jsonb DEFAULT '{}',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ── 4. SECURITY ALERTS TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type            text NOT NULL,
  severity              text NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  status                text DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  
  -- Alert details
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id            uuid REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
  
  -- What triggered the alert
  trigger_event         text,
  trigger_details       jsonb DEFAULT '{}',
  ip_address            text,
  location              jsonb,
  device_info           jsonb,
  
  -- Risk assessment
  risk_score            integer DEFAULT 0,
  risk_factors          text[],
  
  -- Resolution
  acknowledged_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at      timestamptz,
  resolution_notes      text,
  
  -- Notification tracking
  notifications_sent    jsonb DEFAULT '[]',
  email_sent           boolean DEFAULT false,
  sms_sent             boolean DEFAULT false,
  push_sent            boolean DEFAULT false,
  
  -- Metadata
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ── 5. LOGIN HISTORY TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_login_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id            uuid REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
  
  -- Login details
  login_at              timestamptz DEFAULT now(),
  logout_at             timestamptz,
  session_duration      interval GENERATED ALWAYS AS (logout_at - login_at) STORED,
  
  -- Success/failure
  login_status          text NOT NULL CHECK (login_status IN ('success', 'failed', 'locked', 'mfa_failed', 'expired')),
  failure_reason        text,
  failed_attempts       integer DEFAULT 0,
  
  -- Device information
  device_id             text,
  device_type           text,
  device_name           text,
  device_model          text,
  operating_system      text,
  browser               text,
  browser_version       text,
  
  -- Location
  ip_address            text,
  isp                   text,
  location_country      text,
  location_city         text,
  location_latitude     numeric,
  location_longitude    numeric,
  
  -- Security
  is_new_device         boolean DEFAULT false,
  is_new_location       boolean DEFAULT false,
  mfa_used              boolean DEFAULT false,
  mfa_method            text,
  login_method          text,
  
  -- Session info
  is_active             boolean DEFAULT true,
  
  created_at            timestamptz DEFAULT now()
);

-- ── 6. SENSITIVE ACTIONS CONFIG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sensitive_actions_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key            text UNIQUE NOT NULL,
  action_label         text NOT NULL,
  category              text NOT NULL,
  description           text,
  requires_mfa          boolean DEFAULT true,
  requires_approval     boolean DEFAULT false,
  approval_role         text,
  approval_level        integer DEFAULT 1,
  max_value_threshold   numeric,
  notification_channels text[] DEFAULT ARRAY['dashboard', 'email'],
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ── 7. PERMISSION AUDIT LOG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- What changed
  permission_key        text,
  action_type           text NOT NULL CHECK (action_type IN ('granted', 'revoked', 'modified')),
  previous_value        jsonb,
  new_value             jsonb,
  
  -- Context
  reason                text,
  ip_address            text,
  session_id            uuid REFERENCES public.admin_sessions(id) ON DELETE SET NULL,
  
  created_at            timestamptz DEFAULT now()
);

-- ── 8. KNOWN DEVICES/LOCATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_known_devices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  device_id             text NOT NULL,
  device_type           text,
  device_name           text,
  operating_system      text,
  browser               text,
  first_seen_at         timestamptz DEFAULT now(),
  last_seen_at          timestamptz DEFAULT now(),
  seen_count            integer DEFAULT 1,
  is_trusted            boolean DEFAULT true,
  is_blocked            boolean DEFAULT false,
  
  UNIQUE(profile_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.admin_known_locations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  location_hash         text NOT NULL,
  country               text,
  city                  text,
  latitude              numeric,
  longitude             numeric,
  first_seen_at         timestamptz DEFAULT now(),
  last_seen_at          timestamptz DEFAULT now(),
  seen_count            integer DEFAULT 1,
  is_trusted            boolean DEFAULT true,
  is_blocked            boolean DEFAULT false,
  
  UNIQUE(profile_id, location_hash)
);

-- ── 9. SEED SENSITIVE ACTIONS CONFIG ───────────────────────────────────────
INSERT INTO public.sensitive_actions_config (action_key, action_label, category, description, requires_mfa, requires_approval, approval_role, max_value_threshold, notification_channels) VALUES
  ('member.delete', 'Delete Member Account', 'User Management', 'Permanently delete a member account and all associated data', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email', 'sms']),
  ('member.suspend', 'Suspend Member', 'User Management', 'Suspend a member account', false, false, NULL, NULL, ARRAY['dashboard']),
  ('admin.create', 'Create Admin Account', 'Admin Management', 'Create a new administrator account', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email']),
  ('admin.delete', 'Delete Admin Account', 'Admin Management', 'Delete an administrator account', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email']),
  ('admin.role.change', 'Change Admin Role', 'Admin Management', 'Change an admin role or permissions', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email']),
  ('admin.lock', 'Lock Admin Session', 'Security', 'Remotely lock an admin account', true, false, NULL, NULL, ARRAY['dashboard', 'email']),
  ('loan.approve.large', 'Approve Large Loan', 'Loans', 'Approve a loan above the threshold', false, true, 'admin', 1000000, ARRAY['dashboard', 'email']),
  ('loan.reverse', 'Reverse Loan', 'Loans', 'Reverse a completed loan', true, true, 'admin', NULL, ARRAY['dashboard', 'email']),
  ('contribution.reverse', 'Reverse Contribution', 'Finance', 'Reverse a contribution transaction', true, true, 'admin', 100000, ARRAY['dashboard', 'email']),
  ('balance.adjust', 'Adjust Member Balance', 'Finance', 'Manually adjust a member balance', true, true, 'admin', NULL, ARRAY['dashboard', 'email']),
  ('transaction.reverse', 'Reverse Transaction', 'Finance', 'Reverse any financial transaction', true, true, 'admin', 500000, ARRAY['dashboard', 'email']),
  ('settings.change', 'Change System Settings', 'System', 'Modify system configuration', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email']),
  ('policy.change', 'Change Loan Policies', 'System', 'Modify loan or contribution policies', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email']),
  ('fee.change', 'Change Fees', 'System', 'Modify registration fees or minimum contributions', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email']),
  ('feature.toggle', 'Toggle Feature', 'System', 'Enable or disable platform features', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email']),
  ('data.export', 'Export Sensitive Data', 'Reports', 'Export sensitive financial or member data', true, true, 'admin', NULL, ARRAY['dashboard', 'email']),
  ('security.change', 'Change Security Settings', 'Security', 'Modify security configurations', true, true, 'super_admin', NULL, ARRAY['dashboard', 'email'])
ON CONFLICT (action_key) DO NOTHING;

-- ── 10. ADD PROFILE COLUMNS ─────────────────────────────────────────────────
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_session_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS session_lock_reason text,
ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS last_password_change timestamptz,
ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS known_devices_trust_all boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS known_locations_trust_all boolean DEFAULT false;

-- ── 11. CREATE INDEXES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_sessions_profile ON public.admin_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON public.admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON public.admin_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_locked ON public.admin_sessions(is_locked) WHERE is_locked = true;

CREATE INDEX IF NOT EXISTS idx_audit_logs_profile ON public.admin_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_suspicious ON public.admin_audit_logs(is_suspicious) WHERE is_suspicious = true;

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON public.approval_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_approval_requests_initiated ON public.approval_requests(initiated_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created ON public.approval_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON public.approval_requests(status, priority) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON public.security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_active ON public.security_alerts(status, severity) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_login_history_profile ON public.admin_login_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON public.admin_login_history(login_status);
CREATE INDEX IF NOT EXISTS idx_login_history_date ON public.admin_login_history(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_failed ON public.admin_login_history(login_status) WHERE login_status = 'failed';

CREATE INDEX IF NOT EXISTS idx_permission_audit_profile ON public.permission_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_changed_by ON public.permission_audit_logs(changed_by);

CREATE INDEX IF NOT EXISTS idx_known_devices_profile ON public.admin_known_devices(profile_id);
CREATE INDEX IF NOT EXISTS idx_known_locations_profile ON public.admin_known_locations(profile_id);

-- ── 12. ENABLE RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitive_actions_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_known_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_known_locations ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS for all governance tables
DROP POLICY IF EXISTS "service_role_all_admin_sessions" ON public.admin_sessions;
CREATE POLICY "service_role_all_admin_sessions" ON public.admin_sessions FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "service_role_all_audit_logs" ON public.admin_audit_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_approval_requests" ON public.approval_requests;
CREATE POLICY "service_role_all_approval_requests" ON public.approval_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_security_alerts" ON public.security_alerts;
CREATE POLICY "service_role_all_security_alerts" ON public.security_alerts FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_login_history" ON public.admin_login_history;
CREATE POLICY "service_role_all_login_history" ON public.admin_login_history FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_sensitive_actions" ON public.sensitive_actions_config;
CREATE POLICY "service_role_all_sensitive_actions" ON public.sensitive_actions_config FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_permission_audit" ON public.permission_audit_logs;
CREATE POLICY "service_role_all_permission_audit" ON public.permission_audit_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_known_devices" ON public.admin_known_devices;
CREATE POLICY "service_role_all_known_devices" ON public.admin_known_devices FOR ALL USING (true);

DROP POLICY IF EXISTS "service_role_all_known_locations" ON public.admin_known_locations;
CREATE POLICY "service_role_all_known_locations" ON public.admin_known_locations FOR ALL USING (true);

-- Profiles RLS updates for new columns
ALTER TABLE public.profiles DROP POLICY IF EXISTS "service_role_all_profiles_v2" ON public.profiles;
CREATE POLICY "service_role_all_profiles_v2" ON public.profiles FOR ALL USING (true);

-- ── 13. HELPER FUNCTIONS ─────────────────────────────────────────────────────

-- Function to log admin action with full context
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_profile_id uuid,
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_previous_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_details jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
  v_profile RECORD;
  v_session RECORD;
BEGIN
  -- Get profile info
  SELECT role, email, name INTO v_profile FROM public.profiles WHERE id = p_profile_id;
  
  -- Get active session
  SELECT * INTO v_session FROM public.admin_sessions 
  WHERE profile_id = p_profile_id AND is_active = true 
  ORDER BY login_at DESC LIMIT 1;
  
  INSERT INTO public.admin_audit_logs (
    profile_id, action, resource_type, resource_id,
    previous_value, new_value, details,
    actor_email, actor_name, actor_role,
    actor_ip, actor_user_agent, actor_device_info, actor_location
  ) VALUES (
    p_profile_id, p_action, p_resource_type, p_resource_id,
    p_previous_value, p_new_value, p_details,
    v_profile.email, v_profile.name, v_profile.role,
    v_session.ip_address, v_session.user_agent, 
    v_session.device_info, 
    jsonb_build_object(
      'country', v_session.location_country,
      'city', v_session.location_city,
      'latitude', v_session.location_latitude,
      'longitude', v_session.location_longitude
    )
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for suspicious activity
CREATE OR REPLACE FUNCTION public.check_suspicious_activity(
  p_profile_id uuid,
  p_ip_address text,
  p_device_id text,
  p_location_hash text
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb := '{"is_suspicious": false, "risk_score": 0, "risk_factors": []}';
  v_new_device boolean;
  v_new_location boolean;
  v_failed_today integer;
  v_last_login_ip text;
BEGIN
  -- Check if device is known
  SELECT COUNT(*) = 0 INTO v_new_device 
  FROM public.admin_known_devices 
  WHERE profile_id = p_profile_id AND device_id = p_device_id AND is_blocked = false;
  
  -- Check if location is known
  SELECT COUNT(*) = 0 INTO v_new_location 
  FROM public.admin_known_locations 
  WHERE profile_id = p_profile_id AND location_hash = p_location_hash AND is_blocked = false;
  
  -- Count failed logins today
  SELECT COUNT(*) INTO v_failed_today
  FROM public.admin_login_history
  WHERE profile_id = p_profile_id 
    AND login_status = 'failed'
    AND login_at >= CURRENT_DATE;
  
  -- Get last login IP
  SELECT ip_address INTO v_last_login_ip
  FROM public.admin_login_history
  WHERE profile_id = p_profile_id AND login_status = 'success'
  ORDER BY login_at DESC LIMIT 1;
  
  -- Calculate risk score
  IF v_new_device THEN
    v_result := jsonb_set(v_result, '{risk_factors}', v_result->'risk_factors' || '["new_device"]');
    v_result := jsonb_set(v_result, '{risk_score}', (v_result->>'risk_score')::integer + 30);
  END IF;
  
  IF v_new_location THEN
    v_result := jsonb_set(v_result, '{risk_factors}', v_result->'risk_factors' || '["new_location"]');
    v_result := jsonb_set(v_result, '{risk_score}', (v_result->>'risk_score')::integer + 40);
  END IF;
  
  IF v_failed_today > 0 THEN
    v_result := jsonb_set(v_result, '{risk_factors}', v_result->'risk_factors' || to_jsonb(ARRAY['failed_attempts_' || v_failed_today]));
    v_result := jsonb_set(v_result, '{risk_score}', (v_result->>'risk_score')::integer + (v_failed_today * 10));
  END IF;
  
  IF v_last_login_ip IS NOT NULL AND v_last_login_ip != p_ip_address AND v_new_device THEN
    v_result := jsonb_set(v_result, '{risk_factors}', v_result->'risk_factors' || '["unusual_pattern"]');
    v_result := jsonb_set(v_result, '{risk_score}', (v_result->>'risk_score')::integer + 20);
  END IF;
  
  -- Mark as suspicious if risk score > 50
  IF (v_result->>'risk_score')::integer > 50 THEN
    v_result := jsonb_set(v_result, '{is_suspicious}', 'true');
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create security alert
CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_alert_type text,
  p_severity text,
  p_profile_id uuid DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_trigger_event text,
  p_trigger_details jsonb DEFAULT '{}',
  p_ip_address text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_alert_id uuid;
  v_risk_info jsonb;
BEGIN
  -- Calculate risk if profile provided
  IF p_profile_id IS NOT NULL THEN
    v_risk_info := public.check_suspicious_activity(
      p_profile_id,
      COALESCE(p_ip_address, ''),
      COALESCE((p_trigger_details->>'device_id')::text, ''),
      COALESCE((p_trigger_details->>'location_hash')::text, '')
    );
  ELSE
    v_risk_info := '{"is_suspicious": false, "risk_score": 0, "risk_factors": []}';
  END IF;
  
  INSERT INTO public.security_alerts (
    alert_type, severity, profile_id, session_id,
    trigger_event, trigger_details, ip_address,
    risk_score, risk_factors
  ) VALUES (
    p_alert_type, p_severity, p_profile_id, p_session_id,
    p_trigger_event, p_trigger_details, p_ip_address,
    COALESCE((v_risk_info->>'risk_score')::integer, 0),
    ARRAY(SELECT jsonb_array_elements_text(v_risk_info->'risk_factors'))
  ) RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active admin sessions
CREATE OR REPLACE FUNCTION public.get_active_admin_sessions()
RETURNS TABLE (
  session_id uuid,
  profile_id uuid,
  admin_name text,
  admin_email text,
  admin_role text,
  login_at timestamptz,
  last_activity_at timestamptz,
  device_type text,
  operating_system text,
  browser text,
  ip_address text,
  location_country text,
  location_city text,
  is_locked boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id, s.profile_id, p.name, p.email, p.role,
    s.login_at, s.last_activity_at, s.device_type, s.operating_system,
    s.browser, s.ip_address, s.location_country, s.location_city, s.is_locked
  FROM public.admin_sessions s
  JOIN public.profiles p ON p.id = s.profile_id
  WHERE s.is_active = true
    AND p.role IN ('super_admin', 'admin', 'operator', 'viewer')
  ORDER BY s.last_activity_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending approval requests count
CREATE OR REPLACE FUNCTION public.get_pending_approvals_count(p_profile_id uuid DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  v_count integer;
  v_role text;
BEGIN
  IF p_profile_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id;
  ELSE
    v_role := 'super_admin';
  END IF;
  
  IF v_role IN ('super_admin', 'admin') THEN
    SELECT COUNT(*) INTO v_count FROM public.approval_requests WHERE status = 'pending';
  ELSE
    v_count := 0;
  END IF;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to lock admin session
CREATE OR REPLACE FUNCTION public.lock_admin_session(
  p_session_id uuid,
  p_locked_by uuid,
  p_reason text
)
RETURNS boolean AS $$
BEGIN
  UPDATE public.admin_sessions
  SET 
    is_locked = true,
    lock_reason = p_reason,
    locked_by = p_locked_by,
    locked_at = now()
  WHERE id = p_session_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unlock admin session
CREATE OR REPLACE FUNCTION public.unlock_admin_session(p_session_id uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE public.admin_sessions
  SET 
    is_locked = false,
    lock_reason = NULL,
    locked_by = NULL,
    locked_at = NULL
  WHERE id = p_session_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to lock admin profile
CREATE OR REPLACE FUNCTION public.lock_admin_profile(
  p_profile_id uuid,
  p_locked_by uuid,
  p_reason text
)
RETURNS boolean AS $$
BEGIN
  UPDATE public.profiles
  SET 
    is_session_locked = true,
    session_lock_reason = p_reason,
    locked_by = p_locked_by,
    locked_at = now()
  WHERE id = p_profile_id;
  
  -- Also lock all active sessions
  UPDATE public.admin_sessions
  SET 
    is_locked = true,
    lock_reason = p_reason,
    locked_by = p_locked_by,
    locked_at = now()
  WHERE profile_id = p_profile_id AND is_active = true;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER approval_requests_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER security_alerts_updated_at
  BEFORE UPDATE ON public.security_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE TRIGGER sensitive_actions_updated_at
  BEFORE UPDATE ON public.sensitive_actions_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMIT;

-- Done! The Enterprise Governance & Security System is now ready.
-- Next: Run the API routes and frontend components.
