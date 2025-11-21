-- Comprehensive fix for signup 500 errors and user access gating
-- Based on Codex checklist

-- ================================================
-- STEP 1: Ensure user_access table has proper structure
-- ================================================

-- Verify allowed_users table exists and has proper constraints
-- (This should already exist from create-user-access-control.sql)

-- Add index for case-insensitive email lookups if not exists
CREATE INDEX IF NOT EXISTS idx_allowed_users_email_lower
  ON allowed_users(LOWER(email));

-- ================================================
-- STEP 2: Fix the handle_new_user function
-- ================================================

-- Drop and recreate the function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
BEGIN
  -- Extract full name from metadata or use email prefix
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Insert profile (RLS will be bypassed because of SECURITY DEFINER)
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    'viewer'
  );

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, just return
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE WARNING 'Error creating profile for user %: %', NEW.email, SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================
-- STEP 3: Fix RLS policies on profiles
-- ================================================

-- Drop all existing INSERT policies on profiles
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;

-- Create a comprehensive INSERT policy
-- This allows:
-- 1. The SECURITY DEFINER trigger to insert profiles
-- 2. The insert only if the ID matches a user in auth.users
CREATE POLICY "Enable profile creation" ON profiles
  FOR INSERT
  WITH CHECK (
    -- Must be inserting their own profile
    auth.uid() = id
    OR
    -- Or allow if ID exists in auth.users (for trigger context)
    EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id)
  );

-- Ensure UPDATE policy allows users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ================================================
-- STEP 4: Grant necessary permissions
-- ================================================

-- Grant the postgres/service role permission to bypass RLS if needed
-- This ensures the SECURITY DEFINER function can always insert
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL ON public.profiles TO postgres;
GRANT ALL ON public.allowed_users TO postgres;

-- ================================================
-- STEP 5: Verify trigger exists and is properly configured
-- ================================================

-- Drop and recreate trigger to ensure it's properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ================================================
-- STEP 6: Add helper function to check if email is approved
-- ================================================

-- This function should already exist from create-user-access-control.sql
-- But let's verify it's using proper case-insensitive comparison
CREATE OR REPLACE FUNCTION is_email_allowed(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if email is in whitelist (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM allowed_users
    WHERE LOWER(email) = LOWER(user_email)
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Check if email domain is allowed (optional, case-insensitive)
  IF EXISTS (
    SELECT 1 FROM allowed_domains
    WHERE LOWER(user_email) LIKE '%@' || LOWER(domain)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_email_allowed(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_email_allowed(TEXT) TO anon;

-- ================================================
-- DIAGNOSTIC: Check current state
-- ================================================

-- Show all policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- Show all triggers on auth.users
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND event_object_schema = 'auth';

-- Show all functions related to user creation
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_name LIKE '%user%'
AND routine_schema = 'public';
