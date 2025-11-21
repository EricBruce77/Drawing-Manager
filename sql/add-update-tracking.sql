-- Add update tracking columns to drawings table
-- Run this SQL in Supabase SQL Editor

ALTER TABLE drawings
ADD COLUMN IF NOT EXISTS needs_update BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS update_description TEXT,
ADD COLUMN IF NOT EXISTS update_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS update_requested_by UUID REFERENCES auth.users(id);

-- Add index for filtering drawings that need updates
CREATE INDEX IF NOT EXISTS idx_drawings_needs_update ON drawings(needs_update) WHERE needs_update = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN drawings.needs_update IS 'Flag indicating if drawing needs to be updated';
COMMENT ON COLUMN drawings.update_description IS 'Description of what needs to be updated';
COMMENT ON COLUMN drawings.update_requested_at IS 'When the update was requested';
COMMENT ON COLUMN drawings.update_requested_by IS 'User who requested the update';
