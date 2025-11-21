/**
 * Normalize thumbnail URLs to handle both relative paths and full URLs
 * @param {string|null} thumbnailUrl - The thumbnail URL from the database
 * @returns {string|null} - Full public URL or null if no thumbnail
 */
export function normalizeThumb(thumbnailUrl) {
  // Return null if no thumbnail URL provided
  if (!thumbnailUrl) {
    return null
  }

  // If already a full URL (starts with http), return as-is
  if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
    return thumbnailUrl
  }

  // Get Supabase URL from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  // Remove leading slash if present
  const cleanPath = thumbnailUrl.startsWith('/')
    ? thumbnailUrl.substring(1)
    : thumbnailUrl

  // Construct full public URL
  return `${supabaseUrl}/storage/v1/object/public/drawings/${cleanPath}`
}
