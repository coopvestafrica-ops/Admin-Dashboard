-- ═══════════════════════════════════════════════════════════════════════════════
-- CoopVest Africa — Supabase SQL Migration
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. payroll_batches table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_batches (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization     text          NOT NULL,
  month            text          NOT NULL,
  uploaded_at      timestamptz   DEFAULT now(),
  uploaded_by      text          DEFAULT 'Admin',
  record_count     integer       NOT NULL DEFAULT 0,
  total_amount     numeric(15,2) NOT NULL DEFAULT 0,
  status           text          NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','completed','failed')),
  matched_count    integer       NOT NULL DEFAULT 0,
  unmatched_count  integer       NOT NULL DEFAULT 0,
  created_at       timestamptz   DEFAULT now()
);

ALTER TABLE public.payroll_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.payroll_batches;
CREATE POLICY "service_role_all" ON public.payroll_batches FOR ALL USING (true);

-- ── 2. Auto-create profile when a mobile user registers via Supabase Auth ─────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, user_id, name, email, phone, role, is_active, kyc_verified, created_at
  )
  VALUES (
    gen_random_uuid(),
    'CVA-' || upper(substr(replace(new.id::text, '-', ''), 1, 8)),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    COALESCE(new.phone, new.raw_user_meta_data->>'phone'),
    'member',
    true,
    false,
    now()
  )
  ON CONFLICT (email) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. Backfill: create profiles for any existing auth users not yet in profiles
-- (Run once — the ON CONFLICT prevents duplicates)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      id,
      email,
      phone,
      raw_user_meta_data,
      created_at
    FROM auth.users
    WHERE email NOT IN (SELECT email FROM public.profiles WHERE email IS NOT NULL)
  LOOP
    INSERT INTO public.profiles (
      id, user_id, name, email, phone, role, is_active, kyc_verified, created_at
    )
    VALUES (
      gen_random_uuid(),
      'CVA-' || upper(substr(replace(r.id::text, '-', ''), 1, 8)),
      COALESCE(
        r.raw_user_meta_data->>'full_name',
        r.raw_user_meta_data->>'name',
        split_part(r.email, '@', 1)
      ),
      r.email,
      COALESCE(r.phone, r.raw_user_meta_data->>'phone'),
      'member',
      true,
      false,
      COALESCE(r.created_at, now())
    )
    ON CONFLICT (email) DO NOTHING;
  END LOOP;
END;
$$;

-- Done! New mobile registrations will now automatically appear in the admin dashboard.
