-- Make ayanlowo89@gmail.com a super_admin
-- Run this in Supabase Dashboard → SQL Editor

-- Update the profiles table
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'ayanlowo89@gmail.com';

-- Verify the update
SELECT id, name, email, role 
FROM profiles 
WHERE email = 'ayanlowo89@gmail.com';
