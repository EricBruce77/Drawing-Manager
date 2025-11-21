-- Migration: Fix activity_log foreign key constraint to allow deletion audit trail
-- This fixes the issue where deleting a drawing fails because the log_drawing_activity
-- trigger tries to insert a log entry referencing a drawing that's being deleted.

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_drawing_id_fkey;

-- Step 2: Add metadata columns to preserve drawing information after deletion
ALTER TABLE activity_log
ADD COLUMN IF NOT EXISTS drawing_part_number TEXT,
ADD COLUMN IF NOT EXISTS drawing_revision TEXT,
ADD COLUMN IF NOT EXISTS drawing_file_name TEXT;

-- Step 3: Backfill existing activity log entries with drawing metadata
-- (Only for entries where the drawing still exists)
UPDATE activity_log al
SET
    drawing_part_number = d.part_number,
    drawing_revision = d.revision,
    drawing_file_name = d.file_name
FROM drawings d
WHERE al.drawing_id = d.id
AND al.drawing_part_number IS NULL;

-- Step 4: Update the log_drawing_activity trigger to populate metadata fields
CREATE OR REPLACE FUNCTION log_drawing_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_log (
            user_id,
            drawing_id,
            activity,
            details,
            drawing_part_number,
            drawing_revision,
            drawing_file_name
        )
        VALUES (
            NEW.uploaded_by,
            NEW.id,
            'upload',
            jsonb_build_object('file_name', NEW.file_name),
            NEW.part_number,
            NEW.revision,
            NEW.file_name
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.file_url != NEW.file_url THEN
        INSERT INTO activity_log (
            user_id,
            drawing_id,
            activity,
            details,
            drawing_part_number,
            drawing_revision,
            drawing_file_name
        )
        VALUES (
            NEW.uploaded_by,
            NEW.id,
            'edit',
            jsonb_build_object('old_version', OLD.version_number, 'new_version', NEW.version_number),
            NEW.part_number,
            NEW.revision,
            NEW.file_name
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- For DELETE, we capture OLD drawing info since it's about to be removed
        INSERT INTO activity_log (
            user_id,
            drawing_id,
            activity,
            details,
            drawing_part_number,
            drawing_revision,
            drawing_file_name
        )
        VALUES (
            auth.uid(),
            OLD.id,
            'delete',
            jsonb_build_object(
                'file_name', OLD.file_name,
                'part_number', OLD.part_number,
                'revision', OLD.revision,
                'file_type', OLD.file_type
            ),
            OLD.part_number,
            OLD.revision,
            OLD.file_name
        );
    END IF;

    -- For DELETE operations, return OLD instead of NEW
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- The trigger already exists, so we don't need to recreate it
-- CREATE TRIGGER log_drawing_activity_trigger
-- AFTER INSERT OR UPDATE OR DELETE ON drawings
-- FOR EACH ROW EXECUTE FUNCTION log_drawing_activity();

-- Note: drawing_id will remain in the table as a UUID column (no longer a FK),
-- allowing us to keep the reference to deleted drawings for audit purposes.
