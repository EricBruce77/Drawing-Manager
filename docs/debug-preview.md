# Debug Preview Issue - Quick Reference

## Current Database State
✓ file_type: `pdf`
✓ file_url: `1763501041186-TEST002_B_Test-Part.pdf`
✓ file_size: `2708776` (2.58 MB)
✓ Storage file exists: `1763501041186-TEST002_B_Test-Part.pdf` (2.58 MB)

## Common Causes

### 1. Storage RLS Policy Missing for Authenticated Users
The code generates a signed URL as an authenticated user. Check if this policy exists:

```sql
-- Check existing Storage policies
SELECT
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';
```

### 2. Bucket Configuration
Verify the bucket exists and is configured correctly:

```sql
-- Check bucket configuration
SELECT * FROM storage.buckets WHERE id = 'drawings';
```

### 3. CORS Configuration
Supabase Storage requires CORS to be enabled. This is usually automatic, but verify in:
- Supabase Dashboard → Storage → drawings bucket → Configuration

### 4. Signed URL Generation Failing
The code at line 306-312 in DrawingsGrid.jsx generates signed URLs but may fail silently.

## Quick Fix Steps

### Step 1: Verify Storage Bucket Exists
Run in Supabase SQL Editor:
```sql
SELECT * FROM storage.buckets WHERE id = 'drawings';
```

If it doesn't exist, create it:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', false);
```

### Step 2: Add Complete Storage RLS Policies
Run in Supabase SQL Editor:
```sql
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read drawings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'drawings');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload drawings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'drawings');

-- Allow service role full access (for n8n)
CREATE POLICY "Service role full access to drawings"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'drawings')
WITH CHECK (bucket_id = 'drawings');
```

### Step 3: Check Browser Console Error
Open browser DevTools (F12) → Console tab and look for:
- "Error fetching file URL:" messages
- "PDF load error:" messages
- Network errors (Status 403, 404, CORS errors)

### Step 4: Test Signed URL Generation Manually
Add this temporary debug code to DrawingsGrid.jsx line 310:
```javascript
if (!error && data) {
  console.log('✓ Signed URL generated:', data.signedUrl)
  setFileUrl(data.signedUrl)
} else {
  console.error('✗ Signed URL generation failed:', error)
}
```

## Most Likely Fix

Based on the symptoms, the most likely issue is missing Storage RLS policy for authenticated users.

Run this in Supabase SQL Editor:
```sql
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users can read drawings" ON storage.objects;

-- Recreate with correct syntax
CREATE POLICY "Authenticated users can read drawings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'drawings');

-- Verify it was created
SELECT * FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Authenticated users can read drawings';
```

## Next Steps After Fix

1. Hard refresh browser (Ctrl+Shift+R)
2. Try viewing the drawing again
3. Check console for success message: "✓ Signed URL generated: https://..."
4. If still failing, check console for specific error message
