# Complete n8n Workflow with Cloudinary PDF Thumbnails

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Google Drive Trigger                          │
│                  (New file added to folder)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Download File from Google Drive              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Upload to Supabase Storage (drawings/)              │
│           (Set correct Content-Type: image/jpeg, etc.)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               Insert Drawing Record in Database                  │
│                   (thumbnail_url = NULL)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  IF: Is PDF? │
                    └──┬────────┬──┘
                       │        │
               YES ────┘        └──── NO
               (PDF)                  (Image: JPG, PNG, etc.)
                 │                           │
                 ▼                           ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│  CLOUDINARY PATH (NEW)      │  │  EDGE FUNCTION PATH          │
├─────────────────────────────┤  ├──────────────────────────────┤
│                             │  │                              │
│ 1. Get Signed URL for PDF   │  │ 1. Call Edge Function        │
│    from Supabase Storage    │  │    (generate-thumbnail)      │
│                             │  │                              │
│ 2. Upload PDF to Cloudinary │  │ 2. Downloads image from      │
│    (raw resource type)      │  │    Supabase Storage          │
│                             │  │                              │
│ 3. Generate Transformation  │  │ 3. Resizes to 400px using    │
│    URL (pg_1, w_400)        │  │    imagescript               │
│                             │  │                              │
│ 4. Download Thumbnail from  │  │ 4. Uploads thumbnail to      │
│    Cloudinary (JPEG/WEBP)   │  │    thumbnails/ folder        │
│                             │  │                              │
│ 5. Upload Thumbnail to      │  │ 5. Updates database with     │
│    Supabase Storage         │  │    thumbnail_url             │
│    (thumbnails/{id}.jpg)    │  │                              │
│                             │  │                              │
│ 6. Update Database with     │  │                              │
│    thumbnail_url            │  │                              │
│                             │  │                              │
└──────────────┬──────────────┘  └──────────────┬───────────────┘
               │                                 │
               └────────────┬────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │  Dashboard displays thumbnail  │
            │  (all file types supported!)   │
            └───────────────────────────────┘
```

## Key Differences: Cloudinary vs Edge Function

| Feature | Cloudinary (PDFs) | Edge Function (Images) |
|---------|-------------------|------------------------|
| **File Types** | PDF only | JPG, PNG, GIF, WEBP |
| **Processing** | External service | Built-in (imagescript) |
| **Cost** | Free tier: 25k/month | Free (Supabase included) |
| **Speed** | ~2-5 seconds | ~1-2 seconds |
| **Quality** | Excellent (CDN) | Good (direct) |
| **Reliability** | High (Cloudinary SLA) | High (Supabase SLA) |
| **Page Selection** | Any page (pg_1, pg_2...) | N/A |

## Node Configuration Summary

### Core Nodes (All Files)
1. **Google Drive Trigger** - Watches for new files
2. **Download File** - Downloads from Google Drive
3. **Upload to Supabase** - Uploads to `drawings/` bucket
4. **Insert Drawing Record** - Creates DB entry

### Branching Node
5. **IF (Check File Type)** - Routes based on file type
   - Condition: `file_type === 'pdf'`

### PDF Path (6-11)
6. **Get Signed URL** - Downloads PDF from Supabase
7. **Upload to Cloudinary** - Sends PDF to Cloudinary
8. **Generate Thumbnail URL** - Constructs transformation URL
9. **Download Thumbnail** - Gets thumbnail from Cloudinary
10. **Upload to Supabase** - Saves thumbnail to `thumbnails/`
11. **Update Database** - Sets `thumbnail_url`

### Image Path (Single Node)
6. **Call Edge Function** - Generates thumbnail via Supabase function

## Environment Variables Required

```env
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...

# Cloudinary
CLOUDINARY_CLOUD_NAME=dxxxxxxxx
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
```

## Error Handling Strategy

### Non-Blocking Errors
All thumbnail generation nodes are set to:
- **On Error:** `Continue`
- **Retry on Fail:** `true` (2 retries)
- **Timeout:** 30 seconds

**Why?** If thumbnail generation fails, the drawing should still be imported. Users can view the file even without a thumbnail.

### Error Logging
Failed thumbnails are logged to `activity_log` table:
```json
{
  "drawing_id": "uuid",
  "activity": "thumbnail_error",
  "details": {
    "error": "Cloudinary timeout",
    "step": "upload_pdf",
    "timestamp": "2025-11-20T12:00:00Z"
  }
}
```

### Retry Workflow
A separate scheduled workflow runs nightly:
1. Query for drawings where `file_type='pdf' AND thumbnail_url IS NULL`
2. Replay Cloudinary pipeline for each
3. Log results

## Testing Checklist

- [ ] Cloudinary account created
- [ ] Upload preset configured (`pdf-thumbnails`)
- [ ] Environment variables set in n8n
- [ ] IF node added to workflow
- [ ] Cloudinary nodes added (6-11)
- [ ] Error handling configured
- [ ] Test PDF upload → thumbnail appears
- [ ] Test JPG upload → thumbnail appears (regression)
- [ ] Test error handling (upload invalid PDF)
- [ ] Monitor Cloudinary usage dashboard

## Performance Metrics

### Expected Processing Times

| Step | Time | Notes |
|------|------|-------|
| Google Drive → Supabase | 2-5s | Depends on file size |
| Database insert | <1s | Fast |
| **PDF Path** | | |
| - Upload to Cloudinary | 2-4s | PDF size dependent |
| - Thumbnail generation | 1-3s | Page complexity |
| - Download & upload | 1-2s | Network speed |
| **Total (PDF)** | **6-14s** | |
| **Image Path** | | |
| - Edge Function | 1-2s | Fast (local processing) |
| **Total (Image)** | **1-2s** | |

### Storage Requirements

| Type | Size per File | 1000 Files | 10,000 Files |
|------|---------------|------------|--------------|
| Original PDFs | 1-5 MB | 1-5 GB | 10-50 GB |
| PDF Thumbnails | 50-100 KB | 50-100 MB | 500 MB - 1 GB |
| Original Images | 2-5 MB | 2-5 GB | 20-50 GB |
| Image Thumbnails | 30-60 KB | 30-60 MB | 300-600 MB |

## Monitoring & Alerts

### Cloudinary Dashboard
- **Transformations used:** Check monthly quota
- **Storage:** Monitor total storage
- **Failed transformations:** Review error logs

### Supabase Dashboard
- **Storage usage:** Monitor `drawings` bucket size
- **Function logs:** Check Edge Function errors
- **Database queries:** Slow query analysis

### n8n Monitoring
- **Execution history:** Check for failed runs
- **Error rate:** Should be <5%
- **Average execution time:** 5-10 seconds

## Troubleshooting Guide

| Problem | Cause | Solution |
|---------|-------|----------|
| Thumbnail not appearing | `thumbnail_url` not set | Check node 11 (Update Database) |
| Cloudinary 401 error | Wrong API credentials | Verify env vars |
| Timeout on large PDFs | PDF too large (>10 MB) | Increase timeout to 60s |
| Thumbnail quality poor | Low resolution | Change `w_400` to `w_600` |
| Cost exceeding free tier | Too many transformations | Implement caching or upgrade |

---

## Quick Reference URLs

- **Cloudinary Dashboard:** https://console.cloudinary.com
- **Supabase Dashboard:** https://supabase.com/dashboard
- **n8n Workflow:** https://ericbruce.app.n8n.cloud
- **Edge Function Logs:** `npx supabase functions logs generate-thumbnail`
