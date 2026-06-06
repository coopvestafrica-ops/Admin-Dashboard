-- Fix profiles_role_check constraint and set up super admin
-- Run this in Supabase SQL Editor

-- STEP 1: First, let's see what invalid role values exist
SELECT DISTINCT role, COUNT(*) as count FROM profiles GROUP BY role;

-- STEP 2: Fix any NULL or invalid role values to 'member'
UPDATE profiles SET role = 'member' WHERE role IS NULL OR role NOT IN ('member', 'viewer', 'operator', 'admin', 'super_admin');

-- STEP 3: Drop the existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- STEP 4: Add the new constraint with all valid roles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('member', 'viewer', 'operator', 'admin', 'super_admin'));

-- STEP 5: Set up super admin
UPDATE profiles 
SET role = 'super_admin', is_active = true, kyc_verified = true, updated_at = NOW()
WHERE email = 'ayanlowo89@gmail.com';

-- STEP 6: Verify the setup
SELECT id, email, name, role, is_active, kyc_verified 
FROM profiles 
WHERE email = 'ayanlowo89@gmail.com';

-- Also verify all roles are now valid
SELECT DISTINCT role FROM profiles;