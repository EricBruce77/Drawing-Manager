-- Normalize thumbnail URLs to use full public URLs
-- This updates any bare storage paths to full Cloudinary or Supabase URLs

-- First, let's see what we have (diagnostic query)
-- SELECT id, part_number, thumbnail_url
-- FROM drawings
-- WHERE thumbnail_url IS NOT NULL
-- AND thumbnail_url NOT LIKE 'http%'
-- LIMIT 10;

-- Update Supabase storage paths to full public URLs
-- This converts paths like "thumbnails/abc123.jpg" to full public URLs
UPDATE drawings
SET thumbnail_url = CONCAT(
  current_setting('app.settings.supabase_url', true),
  '/storage/v1/object/public/drawings/',
  thumbnail_url
)
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url NOT LIKE 'http%'
  AND thumbnail_url LIKE 'thumbnails/%';

-- Note: You'll need to set the app setting first:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';

-- Or run this simpler version if you prefer:
-- UPDATE drawings
-- SET thumbnail_url = 'https://your-project.supabase.co/storage/v1/object/public/drawings/' || thumbnail_url
-- WHERE thumbnail_url IS NOT NULL
--   AND thumbnail_url NOT LIKE 'http%'
--   AND thumbnail_url LIKE 'thumbnails/%';

-- Verify the update
SELECT id, part_number, thumbnail_url
FROM drawings
WHERE thumbnail_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
