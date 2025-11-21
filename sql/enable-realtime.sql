-- Enable Realtime for the drawings table
-- This allows the frontend to receive instant updates when drawings are added/updated/deleted

-- Add the drawings table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE drawings;

-- Verify Realtime is enabled
-- Run this query to check:
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- The drawings table should appear in the results

-- Optional: Enable realtime for related tables
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- Note: After running this, the frontend will automatically receive updates
-- when any changes occur to these tables (INSERT, UPDATE, DELETE)
