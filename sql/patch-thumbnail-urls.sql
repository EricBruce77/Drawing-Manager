-- Patch existing thumbnail_url values to use full public URLs
-- This migration updates any relative paths to full Supabase Storage URLs
-- Run this in Supabase SQL Editor after Cloudinary PDF thumbnail implementation

-- Update drawings table: convert relative thumbnail paths to full URLs
UPDATE drawings
SET thumbnail_url = 'https://wwbpnuembvfurpapwror.supabase.co/storage/v1/object/public/drawings/' || thumbnail_url
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url != ''
  AND NOT (thumbnail_url LIKE 'http://%' OR thumbnail_url LIKE 'https://%');

-- Verify the update
SELECT
  id,
  part_number,
  file_type,
  thumbnail_url,
  CASE
    WHEN thumbnail_url IS NULL THEN 'No thumbnail'
    WHEN thumbnail_url LIKE 'https://%' THEN 'Full URL ✓'
    ELSE 'Relative path (needs update)'
  END as url_status
FROM drawings
ORDER BY created_at DESC
LIMIT 20;

-- Check count of rows updated
SELECT
  COUNT(*) as total_drawings,
  COUNT(thumbnail_url) as drawings_with_thumbnails,
  COUNT(CASE WHEN thumbnail_url LIKE 'https://%' THEN 1 END) as full_url_thumbnails,
  COUNT(CASE WHEN thumbnail_url IS NOT NULL AND NOT (thumbnail_url LIKE 'https://%') THEN 1 END) as relative_path_thumbnails
FROM drawings;
