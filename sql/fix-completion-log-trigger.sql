-- Fix completion_log trigger to use current user instead of completed_by
-- This fixes the RLS error when marking items as pending

DROP TRIGGER IF EXISTS on_completion_status_change ON drawings;

CREATE OR REPLACE FUNCTION log_completion_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if completion status changed
    IF (TG_OP = 'UPDATE' AND OLD.completion_status != NEW.completion_status) THEN
        INSERT INTO completion_log (drawing_id, user_id, action, quantity_change)
        VALUES (
            NEW.id,
            auth.uid(),  -- Use current authenticated user, not completed_by
            CASE NEW.completion_status
                WHEN 'completed' THEN 'marked_complete'
                WHEN 'in_progress' THEN 'marked_in_progress'
                ELSE 'unmarked'
            END,
            NEW.quantity_completed - OLD.quantity_completed
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;  -- SECURITY DEFINER allows it to bypass RLS

CREATE TRIGGER on_completion_status_change
    AFTER UPDATE ON drawings
    FOR EACH ROW
    EXECUTE FUNCTION log_completion_change();
