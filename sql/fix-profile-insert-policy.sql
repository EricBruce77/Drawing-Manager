-- Fix: Allow profile creation during user signup
-- The handle_new_user() trigger was failing because there's no INSERT policy on profiles table

-- Drop the existing policy if it exists (in case you ran the first version)
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;

-- Add INSERT policy for profile creation during signup
-- This policy allows the SECURITY DEFINER trigger to create profiles
CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT
  WITH CHECK (
    -- Allow insert if the profile ID exists in auth.users
    -- This works because the trigger runs AFTER the user is created
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id)
  );

-- This policy allows a profile to be inserted during the signup trigger
-- by checking if the ID exists in auth.users (which it will by the time the trigger runs)
