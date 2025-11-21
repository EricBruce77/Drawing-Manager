-- Fix Storage permissions for drawings bucket
-- This allows authenticated users to read (view) files from the drawings bucket

CREATE POLICY "Authenticated users can read drawings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'drawings');

-- Verify the policy was created
SELECT * FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Authenticated users can read drawings';
