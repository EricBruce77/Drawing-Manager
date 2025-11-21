-- Change customer_id and project_id from UUID to TEXT in drawings table
-- This removes foreign key constraints and allows storing text values directly

-- Step 1: Drop foreign key constraints
ALTER TABLE drawings
DROP CONSTRAINT IF EXISTS drawings_customer_id_fkey;

ALTER TABLE drawings
DROP CONSTRAINT IF EXISTS drawings_project_id_fkey;

-- Step 2: Change column types from UUID to TEXT
ALTER TABLE drawings
ALTER COLUMN customer_id TYPE TEXT USING customer_id::TEXT;

ALTER TABLE drawings
ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;

-- Step 3: Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'drawings'
  AND column_name IN ('customer_id', 'project_id');

-- Step 4: Check if there are any existing rows (optional)
SELECT
  COUNT(*) as total_drawings,
  COUNT(customer_id) as with_customer,
  COUNT(project_id) as with_project
FROM drawings;
