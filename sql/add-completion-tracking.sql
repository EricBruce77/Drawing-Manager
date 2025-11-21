-- Add completion tracking to drawings table
-- This allows machinists to mark parts as complete

-- Step 1: Add completion fields to drawings table
ALTER TABLE drawings
ADD COLUMN IF NOT EXISTS completion_status TEXT DEFAULT 'pending' CHECK (completion_status IN ('pending', 'in_progress', 'completed')),
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quantity_required INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantity_completed INTEGER DEFAULT 0;

-- Step 2: Create completion_log table for tracking history
CREATE TABLE IF NOT EXISTS completion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drawing_id UUID REFERENCES drawings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'marked_in_progress', 'marked_complete', 'unmarked'
    quantity_change INTEGER, -- How many were completed in this action
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Add RLS policies for completion_log
ALTER TABLE completion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all completion logs"
    ON completion_log FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create completion logs"
    ON completion_log FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Step 4: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_drawings_completion_status ON drawings(completion_status);
CREATE INDEX IF NOT EXISTS idx_drawings_customer_completion ON drawings(customer_id, completion_status);
CREATE INDEX IF NOT EXISTS idx_completion_log_drawing ON completion_log(drawing_id, created_at DESC);

-- Step 5: Create trigger to automatically log completion status changes
CREATE OR REPLACE FUNCTION log_completion_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if completion status changed
    IF (TG_OP = 'UPDATE' AND OLD.completion_status != NEW.completion_status) THEN
        INSERT INTO completion_log (drawing_id, user_id, action, quantity_change)
        VALUES (
            NEW.id,
            NEW.completed_by,
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_completion_status_change
    AFTER UPDATE ON drawings
    FOR EACH ROW
    EXECUTE FUNCTION log_completion_change();

COMMENT ON COLUMN drawings.completion_status IS 'Track whether drawing/part is pending, in progress, or completed';
COMMENT ON COLUMN drawings.completed_by IS 'User who marked this as complete';
COMMENT ON COLUMN drawings.completed_at IS 'Timestamp when marked complete';
COMMENT ON COLUMN drawings.quantity_required IS 'How many parts need to be made';
COMMENT ON COLUMN drawings.quantity_completed IS 'How many parts have been completed';
