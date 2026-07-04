-- ═══════════════════════════════════════════════════════════════════════════════
-- CoopVest Africa — Mobile Registration Profile Fields
-- Run this in your Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add mobile registration fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS lga text,
ADD COLUMN IF NOT EXISTS id_type text DEFAULT 'NIN',
ADD COLUMN IF NOT EXISTS id_number text,
ADD COLUMN IF NOT EXISTS staff_id text,
ADD COLUMN IF NOT EXISTS occupation text,
ADD COLUMN IF NOT EXISTS employer_name text,
ADD COLUMN IF NOT EXISTS employment_type text,
ADD COLUMN IF NOT EXISTS employer_staff_id text,
ADD COLUMN IF NOT EXISTS work_address text,
ADD COLUMN IF NOT EXISTS years_of_employment text,
ADD COLUMN IF NOT EXISTS monthly_amount numeric DEFAULT 5000,
ADD COLUMN IF NOT EXISTS contribution_method text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS preferred_payment_day integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS nok_name text,
ADD COLUMN IF NOT EXISTS nok_relationship text,
ADD COLUMN IF NOT EXISTS nok_phone text,
ADD COLUMN IF NOT EXISTS nok_address text,
ADD COLUMN IF NOT EXISTS contribution_type text DEFAULT 'direct_deposit',
ADD COLUMN IF NOT EXISTS registration_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS kyc_approved_at timestamptz,
ADD COLUMN IF NOT EXISTS selfie_url text,
ADD COLUMN IF NOT EXISTS id_document_url text;

-- Create indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_profiles_registration_completed ON public.profiles(registration_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_profiles_contribution_type ON public.profiles(contribution_type);

-- Ensure service role can access all profile data for the mobile app
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy for service role (backend API) to read/write all profiles
DROP POLICY IF EXISTS "service_role_all_profiles_mobile" ON public.profiles;
CREATE POLICY "service_role_all_profiles_mobile" ON public.profiles FOR ALL USING (true);

-- Policy for users to read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Policy for users to update their own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Done! Mobile registration fields are now available.
