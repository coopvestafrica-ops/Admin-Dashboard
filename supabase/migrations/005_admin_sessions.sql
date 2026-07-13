-- Migration: Create admin_sessions table for session management
-- This table tracks active admin/operator login sessions so super admins
-- can view, lock, and terminate them from the Session Management page.

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_token     TEXT UNIQUE,
  ip_address        TEXT,
  user_agent        TEXT,
  device_type       TEXT,          -- 'desktop' | 'mobile' | 'tablet'
  browser           TEXT,
  operating_system  TEXT,
  location_country  TEXT,
  location_city     TEXT,
  device_info       JSONB DEFAULT '{}'::jsonb,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_locked         BOOLEAN NOT NULL DEFAULT false,
  lock_reason       TEXT,
  locked_by         UUID REFERENCES public.profiles(id),
  locked_at         TIMESTAMPTZ,
  login_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_admin_sessions_profile_id   ON public.admin_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active    ON public.admin_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_login_at     ON public.admin_sessions(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_session_token ON public.admin_sessions(session_token) WHERE session_token IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_sessions_updated_at ON public.admin_sessions;
CREATE TRIGGER trg_admin_sessions_updated_at
  BEFORE UPDATE ON public.admin_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: admins/super_admins can read all sessions; users can only read their own
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all sessions"
  ON public.admin_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can read their own sessions"
  ON public.admin_sessions FOR SELECT
  USING (profile_id = auth.uid());
