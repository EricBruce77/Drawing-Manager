# Cloudinary PDF Thumbnail Integration

This guide walks through integrating Cloudinary to generate thumbnails for PDF files uploaded via n8n.

## Why Cloudinary?

- **Free Tier**: 25,000 transformations/month
- **No Infrastructure**: URL-based transformations, no server needed
- **Fast**: CDN-backed image delivery
- **Easy Integration**: Simple HTTP API works perfectly with n8n

## Step 1: Provision Cloudinary Account

### 1.1 Create Account
1. Go to [cloudinary.com](https://cloudinary.com/users/register/free)
2. Sign up for a free account
3. Verify your email

### 1.2 Get Credentials
After signing in, go to **Dashboard**. You'll see:
- **Cloud name**: (e.g., `dxxxxxxxx`)
- **API Key**: (e.g., `123456789012345`)
- **API Secret**: (e.g., `abcdefghijklmnopqrstuvwxyz`)

**Save these to 1Password or your .env file:**
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 1.3 Create Upload Preset
1. Go to **Settings** → **Upload**
2. Scroll to **Upload presets**
3. Click **Add upload preset**
4. Configure:
   - **Preset name**: `pdf-thumbnails`
   - **Signing Mode**: `Unsigned` (easier for n8n)
   - **Folder**: `aro-drawings`
   - **Resource type**: `Auto`
5. Click **Save**

## Step 2: Update n8n Workflow

Your workflow should now be:

```
1. Google Drive Trigger
2. Download File
3. Upload to Supabase Storage (with correct Content-Type)
4. Insert Drawing Record (thumbnail_url = NULL)
5. [NEW] Check if PDF
6. [NEW] If PDF → Upload to Cloudinary
7. [NEW] Get Cloudinary Thumbnail URL
8. [NEW] Download Thumbnail from Cloudinary
9. [NEW] Upload Thumbnail to Supabase Storage
10. [NEW] Update Drawing with thumbnail_url
11. If Image → Call existing Edge Function for thumbnail
```

### Node 5: Check File Type (IF Node)

**Node Type:** `IF`
**Purpose:** Branch based on file type

**Condition:**
```
{{ $('Insert Drawing Record').item.json[0].file_type.toLowerCase() }} equals 'pdf'
```

**Branches:**
- **True** → Go to Cloudinary nodes
- **False** → Go to existing Edge Function node (for images)

### Node 6: Get Signed URL for PDF (HTTP Request)

**Only runs for PDFs**

**Node Type:** `HTTP Request`
**Purpose:** Get signed URL to download PDF from Supabase Storage

**Configuration:**
- **Method:** `POST`
- **URL:** `{{ $env.SUPABASE_URL }}/storage/v1/object/sign/drawings/{{ $('Insert Drawing Record').item.json[0].file_url }}`
- **Authentication:** `Generic Credential Type`
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`
- **Headers:**
  ```json
  {
    "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
    "Content-Type": "application/json"
  }
  ```
- **Body:**
  ```json
  {
    "expiresIn": 3600
  }
  ```

**Output:** Returns `signedUrl` for the PDF

### Node 7: Upload PDF to Cloudinary (HTTP Request)

**Node Type:** `HTTP Request`
**Purpose:** Upload PDF to Cloudinary for processing

**Configuration:**
- **Method:** `POST`
- **URL:** `https://api.cloudinary.com/v1_1/{{ $env.CLOUDINARY_CLOUD_NAME }}/upload`
- **Send Body:** `Yes`
- **Body Content Type:** `Form-Data`
- **Form Data:**
  ```json
  {
    "file": "{{ $('Get Signed URL for PDF').item.json.signedUrl }}",
    "upload_preset": "pdf-thumbnails",
    "folder": "aro-drawings",
    "public_id": "{{ $('Insert Drawing Record').item.json[0].id }}",
    "resource_type": "raw"
  }
  ```

**Important Settings:**
- **On Error:** `Continue` (non-blocking)
- **Retry on Fail:** `true`
- **Max Retries:** `2`

**Output:** Returns Cloudinary asset info including `public_id`

### Node 8: Get Cloudinary Thumbnail URL (Code Node)

**Node Type:** `Code`
**Purpose:** Construct Cloudinary transformation URL

```javascript
const cloudinaryCloudName = '{{ $env.CLOUDINARY_CLOUD_NAME }}';
const publicId = $input.item.json.public_id;

// Cloudinary transformation URL for first page, 400px width
const thumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_auto,w_400,pg_1/${publicId}.pdf`;

return {
  json: {
    ....$input.item.json,
    cloudinaryThumbnailUrl: thumbnailUrl
  }
};
```

### Node 9: Download Thumbnail from Cloudinary (HTTP Request)

**Node Type:** `HTTP Request`
**Purpose:** Download the transformed thumbnail image

**Configuration:**
- **Method:** `GET`
- **URL:** `{{ $json.cloudinaryThumbnailUrl }}`
- **Response Format:** `File`

**Output:** Binary data of the thumbnail image

### Node 10: Upload Thumbnail to Supabase Storage (HTTP Request)

**Node Type:** `HTTP Request`
**Purpose:** Upload thumbnail to Supabase drawings bucket

**Configuration:**
- **Method:** `POST`
- **URL:** `{{ $env.SUPABASE_URL }}/storage/v1/object/drawings/thumbnails/{{ $('Insert Drawing Record').item.json[0].id }}.jpg`
- **Authentication:** `Generic Credential Type`
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`
- **Headers:**
  ```json
  {
    "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
    "Content-Type": "image/jpeg"
  }
  ```
- **Send Body:** `Yes`
- **Body Content Type:** `Raw`
- **Body:** `{{ $binary.data }}`

### Node 11: Update Drawing with Thumbnail URL (HTTP Request)

**Node Type:** `HTTP Request`
**Purpose:** Update database with thumbnail_url

**Configuration:**
- **Method:** `PATCH`
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/drawings?id=eq.{{ $('Insert Drawing Record').item.json[0].id }}`
- **Authentication:** `Generic Credential Type`
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`
- **Headers:**
  ```json
  {
    "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  }
  ```
- **Body:**
  ```json
  {
    "thumbnail_url": "https://{{ $env.SUPABASE_URL.replace('https://', '') }}/storage/v1/object/public/drawings/thumbnails/{{ $('Insert Drawing Record').item.json[0].id }}.jpg"
  }
  ```

## Step 3: Error Handling & Retry Logic

### Configure Error Handling on Cloudinary Nodes

For all Cloudinary-related nodes (6-11):
1. **On Error:** `Continue`
2. **Retry on Fail:** `true`
3. **Max Retries:** `2`
4. **Retry Interval:** `5000` (5 seconds)

### Log Errors to Activity Log

Add an **Error Handler** node after the Cloudinary branch:

**Node Type:** `Code`
**Trigger:** Only on error

```javascript
const drawing = $('Insert Drawing Record').item.json[0];
const error = $input.item.error;

// Log to Supabase activity_log
await $http.post(`${process.env.SUPABASE_URL}/rest/v1/activity_log`, {
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: {
    drawing_id: drawing.id,
    activity: 'thumbnail_error',
    details: {
      error: error.message,
      step: 'cloudinary_pdf_thumbnail',
      timestamp: new Date().toISOString()
    }
  }
});

return { json: { error: 'Logged thumbnail error' } };
```

## Step 4: Retry Failed Thumbnails (Optional)

Create a separate n8n workflow that runs nightly to retry failed thumbnails.

### Scheduled Workflow

**Trigger:** `Cron` (daily at 2 AM)
```
0 2 * * *
```

**Query Failed PDFs:**
```sql
SELECT id, file_url, file_type
FROM drawings
WHERE file_type = 'pdf'
  AND thumbnail_url IS NULL
  AND created_at > NOW() - INTERVAL '30 days'
LIMIT 50;
```

**For Each Result:**
- Replay the Cloudinary pipeline (nodes 6-11)
- Log success/failure

## Step 5: Environment Variables for n8n

Add these to your n8n environment:

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Supabase (already set)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

## Step 6: Testing

### Test PDF Upload
1. Upload a PDF to your Google Drive folder
2. Watch n8n execution:
   - ✅ File uploads to Supabase Storage
   - ✅ Drawing record created
   - ✅ IF node detects PDF
   - ✅ PDF uploads to Cloudinary
   - ✅ Thumbnail URL generated
   - ✅ Thumbnail downloaded from Cloudinary
   - ✅ Thumbnail uploaded to Supabase Storage
   - ✅ Database updated with thumbnail_url
3. Check Supabase Storage → `thumbnails/` folder for JPG
4. Reload dashboard and verify PDF thumbnail appears

### Test Image Upload (Regression Test)
1. Upload a JPG to Google Drive
2. Verify:
   - ✅ IF node detects non-PDF
   - ✅ Existing Edge Function generates thumbnail
   - ✅ Thumbnail appears on dashboard

## Monitoring

### Cloudinary Usage
Check your Cloudinary dashboard:
- **Dashboard** → **Usage**
- Monitor transformation count (free tier: 25,000/month)

### Failed Thumbnails
Query for PDFs without thumbnails:
```sql
SELECT COUNT(*)
FROM drawings
WHERE file_type = 'pdf'
  AND thumbnail_url IS NULL;
```

## Troubleshooting

### Error: "Invalid signature"
- Check that your API key and secret are correct
- Verify the upload preset is `Unsigned`

### Error: "Resource not found"
- Cloudinary needs time to process large PDFs
- Add a 2-second delay before downloading thumbnail
- Or use a webhook to get notified when transformation is ready

### Error: "Transformation failed"
- Some PDFs are encrypted or corrupted
- Check Cloudinary logs for specific error
- Mark these in your database for manual review

### Thumbnail quality issues
Adjust the transformation URL:
```
https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_90,w_600,pg_1/${publicId}.pdf
```
- `q_90` = 90% quality (default: auto)
- `w_600` = 600px width (default: 400)
- `pg_1` = page 1 (try `pg_2` for page 2)

## Cost Analysis

### Free Tier Limits
- **Transformations:** 25,000/month
- **Storage:** 25 GB
- **Bandwidth:** 25 GB/month

### Expected Usage (10,000 PDFs/month)
- **Transformations:** ~10,000 (within free tier)
- **Storage:** ~500 MB (raw PDFs stored)
- **Bandwidth:** ~50 MB (thumbnails served via Supabase)

**Total Cost:** $0/month ✅

### If You Exceed Free Tier
- Pay-as-you-go: ~$0.003 per transformation
- 10,000 extra transformations = ~$30/month

## Next Steps

After implementing Cloudinary:
1. ✅ Monitor Cloudinary usage dashboard
2. ✅ Set up alerts when approaching free tier limits
3. ✅ Create retry workflow for failed thumbnails
4. ✅ Document Cloudinary credentials in 1Password
5. Consider upgrading to Cloudinary Pro ($89/month) for:
   - 100,000 transformations/month
   - Advanced features (AI cropping, face detection)
   - Priority support

---

**Need help?** Check the [Cloudinary Documentation](https://cloudinary.com/documentation) or contact support.
