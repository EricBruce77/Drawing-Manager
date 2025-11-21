-- Fix foreign key constraints to allow CASCADE deletion
-- This ensures that when a customer is deleted, all their projects are also deleted

-- First, drop the existing foreign key constraint on projects.customer_id
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_customer_id_fkey;

-- Re-add the foreign key constraint WITH CASCADE delete
ALTER TABLE projects
ADD CONSTRAINT projects_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES customers(id)
ON DELETE CASCADE;

-- This means:
-- - When a customer is deleted, all their projects are automatically deleted
-- - When a project is deleted individually, it works normally
