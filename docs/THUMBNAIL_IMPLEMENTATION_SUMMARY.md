# Thumbnail Generation Implementation - Summary

## What Was Built

I've implemented a complete server-side thumbnail generation system for drawings uploaded via Google Drive through n8n workflows.

## Files Created

### 1. Supabase Edge Function
**Location:** `supabase/functions/generate-thumbnail/`

**Files:**
- `index.ts` - Main Edge Function that generates thumbnails
- `deno.json` - Deno configuration with import maps

**Features:**
- ✅ Resizes images (PNG, JPG, JPEG, GIF, WEBP) to 400px width
- ✅ Maintains aspect ratio
- ✅ Uploads thumbnail to `drawings/thumbnails/` folder
- ✅ Updates database with `thumbnail_url`
- ✅ CORS support for web requests
- ✅ Graceful error handling
- ⚠️ PDF support requires external service (documented)

### 2. Documentation
**Files:**
- `n8n-workflow-with-thumbnails.md` - Updated n8n workflow guide
- `THUMBNAIL_DEPLOYMENT.md` - Complete deployment instructions
- `THUMBNAIL_IMPLEMENTATION_SUMMARY.md` - This summary (you are here)

## How It Works

### Current Flow (Browser Uploads)
```
User uploads file in browser
    ↓
Frontend generates thumbnail using pdf.js
    ↓
Uploads both file and thumbnail to Supabase
    ↓
Dashboard displays thumbnail
```

### New Flow (Google Drive Uploads via n8n)
```
File added to Google Drive
    ↓
n8n detects new file
    ↓
Downloads and uploads to Supabase Storage
    ↓
Creates drawing record in database
    ↓
Calls Edge Function to generate thumbnail ← NEW
    ↓
Edge Function:
  - Downloads file from storage
  - Resizes to 400px thumbnail
  - Uploads to thumbnails/ folder
  - Updates database record
    ↓
Dashboard displays thumbnail
```

## What You Need to Do

### Step 1: Deploy the Edge Function
Follow the instructions in [THUMBNAIL_DEPLOYMENT.md](./THUMBNAIL_DEPLOYMENT.md):

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link to project
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Deploy function
supabase functions deploy generate-thumbnail --no-verify-jwt

# Set environment variables
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 2: Update n8n Workflow
Add a new HTTP Request node to your n8n workflow:

**After:** "Insert Drawing Record" node
**Configuration:**
- Method: POST
- URL: `https://YOUR_PROJECT.supabase.co/functions/v1/generate-thumbnail`
- Headers:
  - Authorization: `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
  - apikey: `YOUR_SUPABASE_ANON_KEY`
  - Content-Type: `application/json`
- Body:
  ```json
  {
    "bucketPath": "={{ $('Upload to Supabase Storage').item.json.path }}",
    "drawingId": "={{ $('Insert Drawing Record').item.json[0].id }}"
  }
  ```
- Error Handling: Continue on error (non-blocking)

### Step 3: Configure Storage Policies
Run this SQL in Supabase SQL Editor:

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
```

### Step 4: Test
1. Upload a PNG or JPG to your Google Drive folder
2. Verify n8n workflow executes successfully
3. Check Supabase Storage for `thumbnails/{drawing_id}.jpg`
4. Reload dashboard and confirm thumbnail appears

## File Type Support

### ✅ Fully Supported
- PNG
- JPG/JPEG
- GIF
- WEBP

### ⚠️ Not Yet Supported
- **PDF** - Requires external service (see PDF Solutions below)
- **DWG** - Requires CAD converter
- **DXF** - Requires CAD converter

For PDFs, the workflow will continue successfully but thumbnail generation will fail gracefully. The drawing will still appear in the dashboard with a file type icon instead of a thumbnail.

## PDF Thumbnail Solutions

### ✅ Option 1: Cloudinary (Recommended - Implementation Ready!)
- Free tier: 25,000 transformations/month
- Handles PDF to image conversion
- URL-based transformations (no infrastructure needed)
- Cost after free tier: ~$0.003 per transformation

**📖 Implementation Guide:** See [CLOUDINARY_PDF_THUMBNAILS.md](./CLOUDINARY_PDF_THUMBNAILS.md) for complete step-by-step instructions.

**📊 Workflow Diagram:** See [n8n-workflow-diagram.md](./n8n-workflow-diagram.md) for visual workflow.

### Option 2: pdf.co API
- Free tier: 100 API calls/month
- Dedicated PDF rendering service
- Cost: ~$0.01 per page after free tier

### Option 3: Custom Service
- Deploy separate microservice with pdf-poppler
- Use Google Cloud Run or AWS Lambda
- Full control but requires maintenance

## Cost Analysis

### Supabase Edge Functions
- Free tier: 500,000 invocations/month
- After free tier: $2 per 1M invocations
- **Expected cost for 10,000 drawings/month: $0**

### Storage
- Free tier: 1GB storage
- After free tier: $0.021 per GB/month
- Thumbnails average 50KB each
- **Expected cost for 10,000 thumbnails (~500MB): $0**

### Total Expected Cost
For most use cases: **$0/month** (within free tier)

## Monitoring

### View Function Logs
```bash
supabase functions logs generate-thumbnail --follow
```

### Check Thumbnail Storage
```sql
SELECT
  COUNT(*) as thumbnail_count,
  pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'drawings'
  AND name LIKE 'thumbnails/%';
```

## Troubleshooting

### Thumbnails not appearing?
1. Check function logs: `supabase functions logs generate-thumbnail`
2. Verify storage policies are set correctly
3. Check n8n workflow execution logs
4. Test function manually with curl (see deployment guide)

### Function timing out?
1. Reduce thumbnail size (edit `THUMBNAIL_WIDTH` constant)
2. Lower JPEG quality (edit `JPEG_QUALITY` constant)
3. Check file size limits

### Storage filling up?
1. Set lifecycle policy to delete old thumbnails
2. Reduce thumbnail dimensions
3. Use lower quality settings

## Next Steps (Optional Enhancements)

### 1. PDF Support via Cloudinary
- Integrate Cloudinary in n8n workflow
- Use PDF transformation API
- Estimated effort: 1-2 hours

### 2. Retry Failed Thumbnails
- Create scheduled n8n workflow
- Query for drawings without thumbnails
- Retry thumbnail generation
- Estimated effort: 30 minutes

### 3. CAD File Support (DWG/DXF)
- Integrate with ODA File Converter
- Convert CAD to PDF, then PDF to image
- Estimated effort: 4-6 hours

### 4. Batch Processing
- Create admin UI to regenerate thumbnails
- Process all existing drawings
- Estimated effort: 2-3 hours

## Support & Questions

### Documentation
- **Deployment Guide:** [THUMBNAIL_DEPLOYMENT.md](./THUMBNAIL_DEPLOYMENT.md)
- **n8n Integration:** [n8n-workflow-with-thumbnails.md](./n8n-workflow-with-thumbnails.md)
- **Original Workflow:** [n8n-google-drive-workflow.md](./n8n-google-drive-workflow.md)

### Resources
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- n8n Documentation: https://docs.n8n.io
- ImageScript (Deno): https://deno.land/x/imagescript

### Need Help?
1. Check function logs first
2. Review deployment checklist
3. Test with curl to isolate issue
4. Check Supabase Discord for community support

## Success Metrics

After deployment, you should see:
- ✅ Thumbnails automatically generated for image uploads
- ✅ Dashboard loads faster with optimized thumbnails
- ✅ Consistent thumbnail sizes across all drawings
- ✅ Non-blocking errors for unsupported file types
- ✅ Cost remains within free tier

## Timeline

**Total Implementation Time:** ~3 hours

**Your Deployment Time:** ~30 minutes
- 10 min: Install CLI and deploy function
- 10 min: Update n8n workflow
- 10 min: Test and verify

**Optional PDF integration:** +1-2 hours

---

## Quick Start Commands

```bash
# 1. Install CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref YOUR_PROJECT_REF

# 4. Deploy
supabase functions deploy generate-thumbnail --no-verify-jwt

# 5. Set secrets
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key

# 6. Test
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/generate-thumbnail \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"bucketPath":"test.png","drawingId":"test-id"}'
```

That's it! You're ready to deploy. 🚀
