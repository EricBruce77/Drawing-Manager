-- Fix Viewer Permissions
-- Allow viewers to have full access except for User Access management

-- ================================================
-- DRAWINGS: Allow viewers to INSERT, UPDATE (not DELETE)
-- ================================================

-- Update INSERT policy for drawings
DROP POLICY IF EXISTS "Engineers and admins can upload drawings" ON drawings;
CREATE POLICY "Authenticated users can upload drawings" ON drawings
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Update UPDATE policy for drawings
DROP POLICY IF EXISTS "Engineers and admins can update drawings" ON drawings;
CREATE POLICY "Authenticated users can update drawings" ON drawings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Keep DELETE as admin-only (already correct)

-- ================================================
-- CUSTOMERS: Allow viewers to CREATE and UPDATE
-- ================================================

DROP POLICY IF EXISTS "Engineers and admins can create customers" ON customers;
CREATE POLICY "Authenticated users can create customers" ON customers
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Engineers and admins can update customers" ON customers;
CREATE POLICY "Authenticated users can update customers" ON customers
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Keep DELETE as admin/engineer (update to include viewers)
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON customers;
CREATE POLICY "Authenticated users can delete customers" ON customers
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ================================================
-- PROJECTS: Allow viewers to CREATE and UPDATE
-- ================================================

DROP POLICY IF EXISTS "Engineers and admins can create projects" ON projects;
CREATE POLICY "Authenticated users can create projects" ON projects
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Engineers and admins can update projects" ON projects;
CREATE POLICY "Authenticated users can update projects" ON projects
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Keep DELETE as admin/engineer (update to include viewers)
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON projects;
CREATE POLICY "Authenticated users can delete projects" ON projects
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ================================================
-- TAGS: Allow viewers to manage tags
-- ================================================

DROP POLICY IF EXISTS "Engineers and admins can manage tags" ON tags;
CREATE POLICY "Authenticated users can manage tags" ON tags
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Engineers and admins can manage drawing tags" ON drawing_tags;
CREATE POLICY "Authenticated users can manage drawing tags" ON drawing_tags
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ================================================
-- USER ACCESS: Keep restricted to admins (already done in frontend)
-- ================================================

-- The allowed_users table policies are already correct (admin-only)
-- The frontend already hides "User Access" from non-admins in Sidebar.jsx

-- ================================================
-- ACTIVITY LOG: Keep as-is (users see own, admins see all)
-- ================================================

-- Activity log policies are fine as-is

-- ================================================
-- VERIFICATION
-- ================================================

-- Show updated policies for drawings
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('drawings', 'customers', 'projects')
ORDER BY tablename, cmd;
