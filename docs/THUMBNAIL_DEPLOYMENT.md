# Thumbnail Generation Edge Function - Deployment Guide

This guide walks you through deploying the thumbnail generation Edge Function to Supabase.

## Prerequisites

- Supabase CLI installed
- Supabase project created
- Docker installed (for local testing)

## Step 1: Install Supabase CLI

### Windows
```bash
# Using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase
```

### macOS/Linux
```bash
# Using Homebrew
brew install supabase/tap/supabase

# Or using npm
npm install -g supabase
```

### Verify Installation
```bash
supabase --version
```

## Step 2: Link to Your Supabase Project

```bash
# Navigate to project directory
cd c:\Users\ericb\aro-drawing-manager

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

**Find your project ref:**
- Go to Supabase Dashboard → Project Settings → General
- Copy the "Reference ID"

## Step 3: Test Locally (Optional but Recommended)

### Start Supabase locally
```bash
supabase start
```

### Serve Edge Function locally
```bash
supabase functions serve generate-thumbnail --env-file .env.local
```

### Test with curl
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/generate-thumbnail' \
  --header 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"bucketPath":"test-file.png","drawingId":"123e4567-e89b-12d3-a456-426614174000"}'
```

## Step 4: Deploy to Production

### Deploy the function
```bash
supabase functions deploy generate-thumbnail --no-verify-jwt
```

**Note:** `--no-verify-jwt` allows the function to be called without user authentication (since n8n will call it with service role key)

### Verify deployment
```bash
supabase functions list
```

You should see `generate-thumbnail` in the list with status "ACTIVE"

## Step 5: Set Environment Variables

The Edge Function needs access to Supabase URL and service role key.

### Set secrets
```bash
# Set Supabase URL
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co

# Set service role key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Verify secrets
```bash
supabase secrets list
```

## Step 6: Configure Storage Bucket

Ensure the `drawings` bucket has a `thumbnails/` folder and proper permissions:

### Run in Supabase SQL Editor:
```sql
-- Allow service role to upload thumbnails
CREATE POLICY "Service role can upload thumbnails"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'drawings'
  AND (storage.foldername(name))[1] = 'thumbnails'
);

-- Allow service role to update thumbnails
CREATE POLICY "Service role can update thumbnails"
ON storage.objects FOR UPDATE
TO service_role
USING (
  bucket_id = 'drawings'
  AND (storage.foldername(name))[1] = 'thumbnails'
);

-- Allow authenticated users to read thumbnails
CREATE POLICY "Authenticated users can read thumbnails"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'drawings'
  AND (storage.foldername(name))[1] = 'thumbnails'
);

-- Allow public read for thumbnails (optional - for public galleries)
CREATE POLICY "Public can read thumbnails"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'drawings'
  AND (storage.foldername(name))[1] = 'thumbnails'
);
```

## Step 7: Test Production Function

### Get your function URL
```
https://YOUR_PROJECT.supabase.co/functions/v1/generate-thumbnail
```

### Test with curl
```bash
curl -i --location --request POST 'https://YOUR_PROJECT.supabase.co/functions/v1/generate-thumbnail' \
  --header 'Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY' \
  --header 'apikey: YOUR_SUPABASE_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "bucketPath": "test-image.png",
    "drawingId": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Expected response (success):**
```json
{
  "success": true,
  "thumbnailPath": "thumbnails/123e4567-e89b-12d3-a456-426614174000.jpg",
  "thumbnailUrl": "https://YOUR_PROJECT.supabase.co/storage/v1/object/public/drawings/thumbnails/123e4567-e89b-12d3-a456-426614174000.jpg",
  "drawingId": "123e4567-e89b-12d3-a456-426614174000"
}
```

## Step 8: Monitor Function

### View logs in Supabase Dashboard
1. Go to **Edge Functions** in Supabase Dashboard
2. Click on `generate-thumbnail`
3. View **Logs** tab
4. Monitor for errors or warnings

### View logs with CLI
```bash
supabase functions logs generate-thumbnail --follow
```

## Step 9: Integrate with n8n

Now that the function is deployed, update your n8n workflow:

1. Add **HTTP Request** node after "Insert Drawing Record"
2. Configure as shown in `n8n-workflow-with-thumbnails.md`
3. Test with a sample image upload to Google Drive

## Troubleshooting

### Error: "Function not found"
- Verify deployment: `supabase functions list`
- Check project reference: `supabase projects list`
- Redeploy: `supabase functions deploy generate-thumbnail`

### Error: "Missing environment variables"
- Check secrets: `supabase secrets list`
- Set missing secrets: `supabase secrets set KEY=value`

### Error: "Failed to download file"
- Check storage bucket exists
- Verify RLS policies allow service role to read
- Ensure file path is correct

### Error: "Failed to upload thumbnail"
- Check RLS policies for thumbnails folder
- Verify service role key is correct
- Ensure bucket is not full (check storage limits)

### Function timeout
- Default timeout is 10 seconds
- For large images, consider:
  - Reducing thumbnail size
  - Using lower JPEG quality
  - Processing asynchronously with queue

## Performance Optimization

### Reduce Cold Starts
- Keep function "warm" by calling it every few minutes
- Use a scheduled n8n workflow: `*/5 * * * *` (every 5 minutes)
- Ping function with no-op request

### Optimize Image Processing
- Adjust `THUMBNAIL_WIDTH` constant (default: 400px)
- Adjust `JPEG_QUALITY` constant (default: 80)
- Consider WebP format for better compression

### Monitor Storage Usage
```sql
-- Check thumbnail storage usage
SELECT
  COUNT(*) as thumbnail_count,
  SUM(metadata->>'size')::bigint as total_bytes,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'drawings'
  AND name LIKE 'thumbnails/%';
```

## Updating the Function

### Make changes to code
Edit `supabase/functions/generate-thumbnail/index.ts`

### Redeploy
```bash
supabase functions deploy generate-thumbnail --no-verify-jwt
```

### Verify update
Check logs to confirm new version is running

## Rollback

### List function versions
```bash
supabase functions list --project-ref YOUR_PROJECT_REF
```

### Rollback to previous version
```bash
# Note: Supabase doesn't support direct rollback
# You'll need to redeploy the previous code version
git checkout previous-commit
supabase functions deploy generate-thumbnail
```

## Production Checklist

- [ ] Edge Function deployed successfully
- [ ] Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Storage policies configured
- [ ] Function tested with curl (image file)
- [ ] Function tested with curl (PDF file - should fail gracefully)
- [ ] n8n workflow updated
- [ ] End-to-end test completed
- [ ] Monitoring dashboard set up
- [ ] Team notified of new feature

## Cost Estimation

### Supabase Edge Functions Pricing (as of 2024)
- Free tier: 500,000 function invocations/month
- After free tier: $2 per 1M invocations

### Storage Costs
- Free tier: 1GB storage
- After free tier: $0.021 per GB/month

**Example monthly costs:**
- 10,000 drawings with thumbnails (~50MB) = $0
- 100,000 drawings with thumbnails (~500MB) = $0
- 1,000,000 drawings with thumbnails (~5GB) = ~$0.08/month

## Support

### Need help?
- Supabase Discord: https://discord.supabase.com
- Documentation: https://supabase.com/docs/guides/functions
- Issues: Create issue in this repo

### Known Limitations
1. PDF rendering not yet implemented (requires external service)
2. DWG/DXF files not supported (requires CAD converter)
3. Large files (>10MB) may timeout
4. Cold starts may add 1-2 seconds latency

### Recommended Next Steps
1. Integrate Cloudinary for PDF thumbnails
2. Add retry mechanism in n8n for failures
3. Create scheduled job to process failed thumbnails
4. Set up alerts for function errors
