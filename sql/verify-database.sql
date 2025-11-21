-- Verification script - Run this to check if migrations were successful

-- Check if completion_status column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'drawings'
  AND column_name IN ('completion_status', 'completed_by', 'completed_at', 'quantity_required', 'quantity_completed')
ORDER BY column_name;

-- Check if completion_log table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'completion_log';

-- Check if search_drawings function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'search_drawings';

-- Test if completion_status has correct values
SELECT DISTINCT completion_status
FROM drawings;
