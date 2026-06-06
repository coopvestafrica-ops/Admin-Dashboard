-- Super Admin Setup for Coopvest Admin Dashboard
-- Run this SQL in your Supabase SQL Editor to set ayanlowo89@gmail.com as Super Admin

-- First, let's check if the profile exists
SELECT id, email, name, role, is_active, kyc_verified 
FROM profiles 
WHERE email = 'ayanlowo89@gmail.com';

-- If the profile exists, update it to super_admin
UPDATE profiles 
SET 
  role = 'super_admin',
  is_active = true,
  kyc_verified = true,
  updated_at = NOW()
WHERE email = 'ayanlowo89@gmail.com';

-- If the profile doesn't exist, you'll need to find the auth user first
-- Uncomment and run this to find auth users:
-- SELECT id, email, raw_user_meta_data 
-- FROM auth.users 
-- WHERE email = 'ayanlowo89@gmail.com';

-- Then create a profile for them:
-- INSERT INTO profiles (id, user_id, name, email, role, is_active, kyc_verified, created_at, updated_at)
-- VALUES ('your-user-uuid', 'your-user-uuid', 'Ayanlowo', 'ayanlowo89@gmail.com', 'super_admin', true, true, NOW(), NOW());