-- Add source field to track where drawings come from
-- This allows differentiating between manual uploads and automated Google Drive ingestion

ALTER TABLE drawings
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add comment for documentation
COMMENT ON COLUMN drawings.source IS 'Source of the drawing: manual (uploaded via UI), google_drive (automated ingestion), or other sources';

-- Optional: Add source_metadata jsonb field for storing additional source-specific data
ALTER TABLE drawings
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN drawings.source_metadata IS 'Additional metadata about the source, such as Google Drive file ID, folder path, etc.';

-- Create index for querying by source
CREATE INDEX IF NOT EXISTS idx_drawings_source ON drawings(source);
