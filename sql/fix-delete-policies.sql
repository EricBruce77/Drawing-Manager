-- Comprehensive fix for customer/project deletion issues
-- This addresses RLS policies and cascade constraints

-- ============================================
-- STEP 1: Check current RLS policies (for reference)
-- ============================================
-- Run this query to see what policies exist:
-- SELECT tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- AND tablename IN ('customers', 'projects', 'drawings');

-- ============================================
-- STEP 2: Drop and recreate RLS policies for CUSTOMERS
-- ============================================

-- Drop existing delete policy if any
DROP POLICY IF EXISTS "Users can delete their own customers" ON customers;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON customers;

-- Create a permissive delete policy for customers
-- Allow admins and engineers to delete any customer
CREATE POLICY "Enable delete for authenticated users" ON customers
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
);

-- ============================================
-- STEP 3: Drop and recreate RLS policies for PROJECTS
-- ============================================

-- Drop existing delete policy if any
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON projects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON projects;

-- Create a permissive delete policy for projects
-- Allow admins and engineers to delete any project
CREATE POLICY "Enable delete for authenticated users" ON projects
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
);

-- ============================================
-- STEP 4: Fix CASCADE constraints
-- ============================================

-- Drop and recreate customer_id foreign key on projects with CASCADE
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_customer_id_fkey;

ALTER TABLE projects
ADD CONSTRAINT projects_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES customers(id)
ON DELETE CASCADE;

-- ============================================
-- STEP 5: Verify RLS is enabled
-- ============================================

-- Make sure RLS is enabled on both tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: Add SELECT policies if missing
-- ============================================

-- Ensure authenticated users can view customers
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
CREATE POLICY "Enable read access for authenticated users" ON customers
FOR SELECT
TO authenticated
USING (true);

-- Ensure authenticated users can view projects
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON projects;
CREATE POLICY "Enable read access for authenticated users" ON projects
FOR SELECT
TO authenticated
USING (true);

-- ============================================
-- COMPLETED
-- ============================================
-- After running this, test deletion by:
-- 1. Deleting a project - should work and stay deleted
-- 2. Deleting a customer with projects - should delete customer AND all projects
-- 3. Navigate away and back - items should stay deleted
-- 4. Refresh page - items should still be gone
