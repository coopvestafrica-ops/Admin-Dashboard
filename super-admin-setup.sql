-- Super Admin Setup for Coopvest Admin Dashboard
-- Run this SQL in your Supabase SQL Editor to set ayanlowo89@gmail.com as Super Admin

-- STEP 1: Fix the role constraint if it doesn't include 'super_admin'
-- First, check what the current constraint looks like:
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint 
WHERE conname = 'profiles_role_check';

-- Drop the existing constraint if it exists (to recreate with correct values)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Recreate constraint with all required roles including super_admin
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('member', 'viewer', 'operator', 'admin', 'super_admin'));

-- STEP 2: Check if the profile exists
SELECT id, email, name, role, is_active, kyc_verified 
FROM profiles 
WHERE email = 'ayanlowo89@gmail.com';

-- STEP 3: If the profile exists, update it to super_admin
UPDATE profiles 
SET 
  role = 'super_admin',
  is_active = true,
  kyc_verified = true,
  updated_at = NOW()
WHERE email = 'ayanlowo89@gmail.com';

-- STEP 4: Verify the update
SELECT id, email, name, role, is_active, kyc_verified 
FROM profiles 
WHERE email = 'ayanlowo89@gmail.com';

-- If the profile doesn't exist, you'll need to find the auth user first
-- Uncomment and run this to find auth users:
-- SELECT id, email, raw_user_meta_data 
-- FROM auth.users 
-- WHERE email = 'ayanlowo89@gmail.com';

-- Then create a profile for them:
-- INSERT INTO profiles (id, user_id, name, email, role, is_active, kyc_verified, created_at, updated_at)
-- VALUES ('your-user-uuid', 'your-user-uuid', 'Ayanlowo', 'ayanlowo89@gmail.com', 'super_admin', true, true, NOW(), NOW());