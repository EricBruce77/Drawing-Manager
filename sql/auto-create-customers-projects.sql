-- Function to automatically create customers and projects when a drawing is inserted
-- This ensures that any new customer_name or project_name in a drawing gets added to the respective tables

CREATE OR REPLACE FUNCTION auto_create_customer_and_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-create customer if customer_name is provided and doesn't exist
  IF NEW.customer_name IS NOT NULL AND NEW.customer_name != '' THEN
    INSERT INTO customers (name, created_by)
    SELECT NEW.customer_name, NEW.uploaded_by
    WHERE NOT EXISTS (
      SELECT 1 FROM customers WHERE name = NEW.customer_name
    );
  END IF;

  -- Auto-create project if project_name is provided and doesn't exist
  IF NEW.project_name IS NOT NULL AND NEW.project_name != '' THEN
    -- If we have both customer and project, link them
    IF NEW.customer_name IS NOT NULL AND NEW.customer_name != '' THEN
      INSERT INTO projects (name, customer_id, created_by)
      SELECT
        NEW.project_name,
        (SELECT id FROM customers WHERE name = NEW.customer_name LIMIT 1),
        NEW.uploaded_by
      WHERE NOT EXISTS (
        SELECT 1 FROM projects WHERE name = NEW.project_name
      );
    ELSE
      -- If no customer, create project without customer_id
      INSERT INTO projects (name, created_by)
      SELECT NEW.project_name, NEW.uploaded_by
      WHERE NOT EXISTS (
        SELECT 1 FROM projects WHERE name = NEW.project_name
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs AFTER INSERT or UPDATE on drawings
DROP TRIGGER IF EXISTS trigger_auto_create_customer_project ON drawings;
CREATE TRIGGER trigger_auto_create_customer_project
  AFTER INSERT OR UPDATE OF customer_name, project_name ON drawings
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_customer_and_project();
