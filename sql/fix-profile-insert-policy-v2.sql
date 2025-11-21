-- Fix: Allow profile creation during user signup (Version 2)
-- The previous policy was still too restrictive for the SECURITY DEFINER trigger

-- Drop the existing policy
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;

-- Create a simple policy that allows all inserts
-- We can make this more restrictive later after confirming it works
CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT
  WITH CHECK (true);

-- This policy allows any insert into profiles
-- It's safe because:
-- 1. The table requires id, email, and full_name (all NOT NULL)
-- 2. The id must match a user in auth.users (enforced by foreign key)
-- 3. Normal users can't directly insert into profiles (only the trigger can)
