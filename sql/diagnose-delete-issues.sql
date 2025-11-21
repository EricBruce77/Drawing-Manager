-- Diagnostic queries to identify why deletes are failing

-- ============================================
-- 1. Check RLS policies on customers and projects
-- ============================================
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('customers', 'projects', 'drawings')
ORDER BY tablename, cmd;

-- ============================================
-- 2. Check foreign key constraints
-- ============================================
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND (tc.table_name IN ('customers', 'projects', 'drawings')
     OR ccu.table_name IN ('customers', 'projects', 'drawings'))
ORDER BY tc.table_name;

-- ============================================
-- 3. Check if RLS is enabled
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('customers', 'projects', 'drawings');

-- ============================================
-- 4. Test delete permissions (run as your user)
-- ============================================
-- This will show if you can delete from these tables
-- (This is a read-only check, won't actually delete)
SELECT
  'customers' as table_name,
  has_table_privilege('customers', 'DELETE') as can_delete
UNION ALL
SELECT
  'projects' as table_name,
  has_table_privilege('projects', 'DELETE') as can_delete
UNION ALL
SELECT
  'drawings' as table_name,
  has_table_privilege('drawings', 'DELETE') as can_delete;
