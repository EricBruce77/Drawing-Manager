# n8n Google Drive Workflow with Thumbnail Generation

This document extends the base Google Drive workflow to include automatic thumbnail generation for uploaded drawings.

## Overview

The enhanced workflow adds server-side thumbnail generation after uploading files to Supabase. This ensures that drawings uploaded via Google Drive have thumbnails just like browser uploads.

## Workflow Structure

### Nodes 1-5: Base Workflow
Follow the steps in `n8n-google-drive-workflow.md` for:
1. Google Drive Trigger
2. Extract Metadata
3. Download File
4. Upload to Supabase Storage
5. Insert Drawing Record

### Node 6: Generate Thumbnail (NEW)
**Node Type:** `HTTP Request`
**Purpose:** Call Supabase Edge Function to generate thumbnail

**Configuration:**
- **Method:** `POST`
- **URL:** `https://YOUR_PROJECT.supabase.co/functions/v1/generate-thumbnail`
- **Authentication:** `Generic Credential Type`
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
- **Headers:**
  ```
  apikey: YOUR_SUPABASE_ANON_KEY
  Content-Type: application/json
  ```
- **Send Body:** Yes
- **Body Content Type:** `JSON`
- **JSON Body:**

```json
{
  "bucketPath": "={{ $('Upload to Supabase Storage').item.json.path }}",
  "drawingId": "={{ $('Insert Drawing Record').item.json[0].id }}"
}
```

**Error Handling:**
Add error handling to continue workflow even if thumbnail generation fails (especially for PDFs which may not be supported yet).

**Settings:**
- **On Error:** `Continue`
- **Retry on Fail:** `true`
- **Max Retries:** `2`
- **Retry Interval:** `5000` (5 seconds)

### Node 7: Log Thumbnail Result (Optional)
**Node Type:** `Code`
**Purpose:** Log success/failure for monitoring

```javascript
const thumbnailResult = $input.item.json

if (thumbnailResult.success) {
  console.log(`Thumbnail generated: ${thumbnailResult.thumbnailUrl}`)
  return {
    json: {
      ...thumbnailResult,
      message: 'Thumbnail generated successfully'
    }
  }
} else {
  console.warn(`Thumbnail generation failed: ${thumbnailResult.error}`)
  return {
    json: {
      ...thumbnailResult,
      message: 'Thumbnail generation skipped or failed (non-blocking)'
    }
  }
}
```

## File Type Support

### Supported for Thumbnails
- ✅ **PNG** - Full support
- ✅ **JPG/JPEG** - Full support
- ✅ **GIF** - Full support
- ✅ **WEBP** - Full support

### Limited/No Support
- ⚠️ **PDF** - Requires external service (see PDF Solutions below)
- ⚠️ **DWG** - Not supported (requires AutoCAD API or conversion)
- ⚠️ **DXF** - Not supported (requires CAD rendering)

## PDF Thumbnail Solutions

Since PDF rendering in Deno Edge Functions is complex, here are recommended approaches:

### Option 1: Cloudinary (Recommended)
Use Cloudinary's PDF-to-image transformation:

**Add Cloudinary Upload Node:**
```
Method: POST
URL: https://api.cloudinary.com/v1_1/YOUR_CLOUD/image/upload
```

**Body:**
```json
{
  "file": "={{ $binary.data }}",
  "upload_preset": "drawings_thumbnails",
  "transformation": "w_400,c_limit,f_jpg,pg_1"
}
```

Then use the Cloudinary URL as `thumbnail_url`.

### Option 2: pdf.co API
Use pdf.co's PDF rendering service:

**HTTP Request Node:**
```
Method: POST
URL: https://api.pdf.co/v1/pdf/convert/to/jpg
Headers: x-api-key: YOUR_PDF_CO_KEY
```

### Option 3: Custom Docker Service
Deploy a separate microservice using:
- `pdf-poppler` + `sharp` for Node.js
- Google Cloud Run or AWS Lambda
- Accepts PDF, returns thumbnail JPEG

## Workflow Diagram

```
Google Drive Trigger
       ↓
Extract Metadata
       ↓
Download File
       ↓
Upload to Supabase Storage
       ↓
Insert Drawing Record
       ↓
Generate Thumbnail (Edge Function) ← NEW
       ↓
[Success] → Continue
[Error] → Log & Continue (non-blocking)
       ↓
(Optional) Send Notification
```

## Testing

### Test with Image File
1. Upload `test-image.png` to Google Drive folder
2. Verify workflow executes
3. Check Supabase Storage for `thumbnails/{drawing_id}.jpg`
4. Verify drawings table has `thumbnail_url` populated
5. Reload dashboard and confirm thumbnail displays

### Test with PDF File
1. Upload `test-drawing.pdf` to Google Drive folder
2. Workflow will execute but thumbnail generation will fail gracefully
3. Drawing still appears in dashboard (without thumbnail)
4. Log will show thumbnail error (non-blocking)

## Monitoring

### Check Thumbnail Generation Logs
In Supabase Dashboard:
1. Go to **Edge Functions** → **generate-thumbnail**
2. View **Logs** tab
3. Filter for errors or warnings

### Common Issues

**Issue: "Failed to download file"**
- Check Storage bucket permissions
- Verify service role key is correct

**Issue: "Failed to decode image"**
- File may be corrupted
- File format may not be supported

**Issue: "PDF thumbnail generation requires external service"**
- Expected for PDFs
- Configure Cloudinary or pdf.co integration

## Environment Variables

Add to your n8n environment:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
EDGE_FUNCTION_URL=https://YOUR_PROJECT.supabase.co/functions/v1/generate-thumbnail
```

## Fallback Strategy

If thumbnail generation fails:
1. Drawing still imports successfully
2. Card displays file type icon instead of thumbnail
3. User experience is not broken
4. Admin can manually regenerate thumbnail later

## Future Enhancements

### Batch Thumbnail Generation
Create a scheduled function to process drawings without thumbnails:

```sql
-- Find drawings without thumbnails
SELECT id, file_url, file_type
FROM drawings
WHERE thumbnail_url IS NULL
AND file_type IN ('png', 'jpg', 'jpeg', 'gif')
LIMIT 10;
```

### PDF Rendering Service
Build dedicated microservice for PDF rendering:
- Accepts PDF via URL
- Returns thumbnail JPEG
- Queues large PDFs for background processing

### DWG/DXF Support
Integrate with AutoCAD API or ODA File Converter for CAD thumbnails.

## Troubleshooting

### Thumbnail not appearing in dashboard
1. Check `thumbnail_url` in database
2. Verify URL is accessible (public storage)
3. Check browser console for CORS issues

### Edge Function timeout
1. Large files may timeout
2. Consider async processing with queue
3. Reduce thumbnail size or quality

### High storage costs
1. Limit thumbnail dimensions (400px)
2. Use JPEG with 70-80% quality
3. Set lifecycle policy to delete orphaned thumbnails

## Deployment Checklist

- [ ] Deploy Edge Function to Supabase
- [ ] Test Edge Function with curl/Postman
- [ ] Update n8n workflow with thumbnail node
- [ ] Test with image file
- [ ] Test with PDF file (confirm graceful failure)
- [ ] Monitor logs for first 24 hours
- [ ] Document any PDF workaround for team

## Next Steps

1. Deploy the Edge Function (see `THUMBNAIL_DEPLOYMENT.md`)
2. Update your n8n workflow
3. Test with sample files
4. Monitor and optimize based on usage
5. Consider PDF rendering solution if needed
