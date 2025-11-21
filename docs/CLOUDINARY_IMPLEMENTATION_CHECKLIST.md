# Cloudinary PDF Thumbnail Implementation - Complete Checklist

This is your step-by-step guide to implementing Cloudinary-based PDF thumbnail generation in your n8n workflow.

## 🎯 Goal

Enable automatic thumbnail generation for PDF files uploaded via Google Drive → n8n → Supabase, using Cloudinary's free tier (25,000 transformations/month).

---

## ✅ Pre-Implementation Checklist

Before you start, verify you have:

- [ ] Access to n8n workflow at `https://ericbruce.app.n8n.cloud`
- [ ] Supabase project credentials (URL, anon key, service role key)
- [ ] Existing n8n workflow that uploads files from Google Drive to Supabase
- [ ] 1Password or secure storage for API keys
- [ ] 30-60 minutes to complete implementation

---

## 📋 STEP 1: Provision Cloudinary Account (10 minutes)

### 1.1 Create Account
1. Go to [cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up with your work email
3. Verify email
4. Login to dashboard

### 1.2 Get Credentials
In the Cloudinary Dashboard, you'll see:

```
Cloud name: dxxxxxxxx
API Key: 123456789012345
API Secret: abcdefghijklmnopqrstuvwxyz
```

**✏️ ACTION:** Copy these to 1Password with label: "Cloudinary - ARO Drawing Manager"

### 1.3 Create Upload Preset
1. Click **Settings** (gear icon) → **Upload**
2. Scroll to **Upload presets** section
3. Click **Add upload preset**
4. Configure:
   - **Preset name:** `pdf-thumbnails`
   - **Signing Mode:** Select **Unsigned** (important for n8n)
   - **Folder:** Enter `aro-drawings`
   - **Resource type:** Select **Auto**
5. Click **Save**

**✅ Checkpoint:** You should see `pdf-thumbnails` in your upload presets list.

---

## 📋 STEP 2: Add Environment Variables to n8n (5 minutes)

### 2.1 Access n8n Settings
1. Login to `https://ericbruce.app.n8n.cloud`
2. Click **Settings** → **Environments** (or **Variables**)

### 2.2 Add Cloudinary Variables
Add these three new environment variables:

| Name | Value | Example |
|------|-------|---------|
| `CLOUDINARY_CLOUD_NAME` | Your cloud name | `dxxxxxxxx` |
| `CLOUDINARY_API_KEY` | Your API key | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Your API secret | `abcdefg...xyz` |

**✅ Checkpoint:** All three variables should be saved and accessible in workflow expressions.

---

## 📋 STEP 3: Update n8n Workflow - Add IF Node (5 minutes)

### 3.1 Open Your Google Drive Workflow
1. Go to **Workflows** in n8n
2. Open your existing "Google Drive to Supabase" workflow
3. Locate the **"Insert Drawing Record"** node

### 3.2 Add IF Node After "Insert Drawing Record"
1. Click the **+** button after "Insert Drawing Record"
2. Search for **IF** node
3. Add it to the canvas
4. Configure:

**Node Name:** `Check if PDF`

**Condition:**
- **Type:** String
- **Value 1:** `{{ $('Insert Drawing Record').item.json[0].file_type }}`
- **Operation:** `equals`
- **Value 2:** `pdf`

**✅ Checkpoint:** The IF node should have two output branches: **true** and **false**.

---

## 📋 STEP 4: Add Cloudinary Nodes (PDF Path - TRUE Branch) (20 minutes)

Connect these nodes to the **TRUE** output of the IF node (for PDFs).

### Node 6: Get Signed URL for PDF

**Node Type:** `HTTP Request`

**Settings:**
- **Method:** `POST`
- **URL:**
  ```
  {{ $env.SUPABASE_URL }}/storage/v1/object/sign/drawings/{{ $('Insert Drawing Record').item.json[0].file_url }}
  ```

**Authentication:**
- **Type:** `Generic Credential Type`
- **Header Name:** `Authorization`
- **Header Value:** `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`

**Headers:**
```json
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "expiresIn": 3600
}
```

**Options:**
- **On Error:** `Continue`
- **Retry on Fail:** `true`
- **Max Retries:** `2`

---

### Node 7: Upload PDF to Cloudinary

**Node Type:** `HTTP Request`

**Settings:**
- **Method:** `POST`
- **URL:**
  ```
  https://api.cloudinary.com/v1_1/{{ $env.CLOUDINARY_CLOUD_NAME }}/upload
  ```

**Body Content Type:** `Form-Data`

**Form Data:**
```json
{
  "file": "{{ $('Get Signed URL for PDF').item.json.signedUrl }}",
  "upload_preset": "pdf-thumbnails",
  "folder": "aro-drawings",
  "public_id": "{{ $('Insert Drawing Record').item.json[0].id }}",
  "resource_type": "raw"
}
```

**Options:**
- **On Error:** `Continue`
- **Retry on Fail:** `true`
- **Max Retries:** `2`
- **Timeout:** `30000` (30 seconds)

---

### Node 8: Generate Cloudinary Thumbnail URL

**Node Type:** `Code`

**Code (JavaScript):**
```javascript
const cloudinaryCloudName = $env.CLOUDINARY_CLOUD_NAME;
const publicId = $input.item.json.public_id;

// Cloudinary transformation URL: first page, 400px width, auto format/quality
const thumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_auto,w_400,pg_1/${publicId}.pdf`;

return {
  json: {
    ...$input.item.json,
    cloudinaryThumbnailUrl: thumbnailUrl,
    drawing_id: $('Insert Drawing Record').item.json[0].id
  }
};
```

---

### Node 9: Download Thumbnail from Cloudinary

**Node Type:** `HTTP Request`

**Settings:**
- **Method:** `GET`
- **URL:** `{{ $json.cloudinaryThumbnailUrl }}`
- **Response Format:** `File`

**Options:**
- **Timeout:** `20000` (20 seconds)

---

### Node 10: Upload Thumbnail to Supabase Storage

**Node Type:** `HTTP Request`

**Settings:**
- **Method:** `POST`
- **URL:**
  ```
  {{ $env.SUPABASE_URL }}/storage/v1/object/drawings/thumbnails/{{ $json.drawing_id }}.jpg
  ```

**Authentication:**
- **Type:** `Generic Credential Type`
- **Header Name:** `Authorization`
- **Header Value:** `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`

**Headers:**
```json
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "image/jpeg"
}
```

**Body:**
- **Content Type:** `Raw/Custom`
- **Body:** `{{ $binary.data }}`

---

### Node 11: Update Drawing with Thumbnail URL

**Node Type:** `HTTP Request`

**Settings:**
- **Method:** `PATCH`
- **URL:**
  ```
  {{ $env.SUPABASE_URL }}/rest/v1/drawings?id=eq.{{ $json.drawing_id }}
  ```

**Authentication:**
- **Type:** `Generic Credential Type`
- **Header Name:** `Authorization`
- **Header Value:** `Bearer {{ $env.SUPABASE_SERVICE_KEY }}`

**Headers:**
```json
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "application/json",
  "Prefer": "return=representation"
}
```

**Body (JSON):**
```json
{
  "thumbnail_url": "thumbnails/{{ $json.drawing_id }}.jpg"
}
```

---

## 📋 STEP 5: Connect Existing Edge Function (Image Path - FALSE Branch) (2 minutes)

For the **FALSE** branch of the IF node (non-PDF images):

1. Find your existing **"Call Edge Function"** or **"Generate Thumbnail"** HTTP Request node
2. Connect the **FALSE** output of the IF node to this existing node
3. This handles JPG, PNG, WEBP thumbnails via your existing Supabase Edge Function

**✅ Checkpoint:** Your workflow should now branch:
- **PDF** → Cloudinary path (nodes 6-11)
- **Images** → Existing Edge Function

---

## 📋 STEP 6: Error Handling (5 minutes)

### 6.1 Add Error Logger Node (Optional but Recommended)

Add an **Error Trigger** node that catches failures:

**Node Type:** `Error Trigger`

Connect to a **Code** node with:

```javascript
const drawing = $('Insert Drawing Record').item.json[0];
const error = $input.item.error;

// Log to Supabase activity_log table
const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/activity_log`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    drawing_id: drawing.id,
    activity: 'thumbnail_error',
    details: {
      error: error.message,
      step: 'cloudinary_pdf_thumbnail',
      timestamp: new Date().toISOString()
    }
  })
});

return { json: { logged: true } };
```

---

## 📋 STEP 7: Testing (10 minutes)

### 7.1 Test PDF Upload

1. **Prepare test PDF:**
   - Create a simple 1-page PDF (or use an existing drawing)
   - Rename: `TEST-001_A_Test-Drawing.pdf`

2. **Upload to Google Drive:**
   - Upload to your monitored Google Drive folder

3. **Watch n8n execution:**
   - Go to **Executions** in n8n
   - Watch the workflow run
   - Verify each node succeeds:
     - ✅ File downloaded from Google Drive
     - ✅ Uploaded to Supabase Storage
     - ✅ Drawing record inserted
     - ✅ IF node routes to TRUE (PDF path)
     - ✅ PDF uploaded to Cloudinary
     - ✅ Thumbnail URL generated
     - ✅ Thumbnail downloaded
     - ✅ Thumbnail uploaded to Supabase
     - ✅ Database updated

4. **Verify in Supabase:**
   - Go to Supabase Storage → `drawings` bucket → `thumbnails` folder
   - Check for `{drawing_id}.jpg`
   - Open drawing in your web app - thumbnail should display

### 7.2 Test Image Upload (Regression Test)

1. **Upload JPG to Google Drive:**
   - Use a JPG/PNG file: `TEST-002_A_Test-Image.jpg`

2. **Verify:**
   - ✅ IF node routes to FALSE (Image path)
   - ✅ Existing Edge Function generates thumbnail
   - ✅ Thumbnail appears in web app

**✅ Checkpoint:** Both PDFs and images should now have thumbnails.

---

## 📋 STEP 8: Monitor & Optimize (Ongoing)

### Daily Monitoring

**Cloudinary Dashboard:**
- Check **Transformations Used** (free tier: 25,000/month)
- Target: Stay under 20,000/month

**Supabase Dashboard:**
- Check **Storage Size** for `thumbnails/` folder
- Check **Edge Function Logs** for errors

**n8n Dashboard:**
- Review **Execution History** for failures
- Target error rate: <5%

### Set Alerts

**Cloudinary:**
- Go to **Settings** → **Notifications**
- Enable alert at 80% of transformation quota (20,000)

**n8n:**
- Enable email notifications for failed workflows

---

## 📋 STEP 9: Optional Enhancements

### 9.1 Retry Failed Thumbnails Workflow (30 minutes)

Create a new scheduled n8n workflow:

**Trigger:** Cron - Daily at 2 AM
```
0 2 * * *
```

**Query Supabase for Failed PDFs:**
```sql
SELECT id, file_url, file_type
FROM drawings
WHERE file_type = 'pdf'
  AND thumbnail_url IS NULL
  AND created_at > NOW() - INTERVAL '30 days'
LIMIT 50;
```

**For Each Result:**
- Replay nodes 6-11 (Cloudinary pipeline)
- Update database on success

### 9.2 Adjust Thumbnail Quality

If thumbnails look pixelated, change Node 8 code:

```javascript
// Higher quality, larger size
const thumbnailUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_90,w_600,pg_1/${publicId}.pdf`;
```

Adjustments:
- `q_90` = 90% quality (vs auto)
- `w_600` = 600px width (vs 400px)
- `pg_2` = Use page 2 instead of page 1

---

## 🚀 Quick Reference

### Cloudinary URLs
- **Dashboard:** https://console.cloudinary.com
- **Documentation:** https://cloudinary.com/documentation/image_transformations

### Supabase Commands
```bash
# View Edge Function logs
npx supabase functions logs generate-thumbnail --follow

# Check thumbnail storage
SELECT COUNT(*), pg_size_pretty(SUM(metadata->>'size')::bigint)
FROM storage.objects
WHERE bucket_id = 'drawings' AND name LIKE 'thumbnails/%';
```

### n8n Workflow URL
- https://ericbruce.app.n8n.cloud

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Cloudinary 401 error** | Check API credentials in n8n env vars |
| **Timeout on large PDFs** | Increase timeout to 60s in Node 7 |
| **Thumbnail not appearing** | Check Node 11 executed successfully |
| **Thumbnail quality poor** | Change `w_400` to `w_600` in Node 8 |
| **Exceeded free tier** | Check usage at console.cloudinary.com |

---

## ✅ Final Checklist

- [ ] Cloudinary account created & credentials saved to 1Password
- [ ] Upload preset `pdf-thumbnails` created
- [ ] Environment variables added to n8n
- [ ] IF node added to workflow
- [ ] Cloudinary nodes (6-11) added and configured
- [ ] Existing Edge Function connected to FALSE branch
- [ ] Error handling configured
- [ ] Test PDF uploaded successfully → thumbnail generated
- [ ] Test JPG uploaded successfully → thumbnail generated
- [ ] Monitoring enabled (Cloudinary alerts, n8n notifications)
- [ ] Documentation saved in project folder

---

## 📊 Success Metrics

After implementation, you should achieve:

- ✅ **100% file type coverage** - PDFs and images both get thumbnails
- ✅ **<10 second processing time** - From upload to thumbnail ready
- ✅ **<5% error rate** - Most files process successfully
- ✅ **$0/month cost** - Stay within Cloudinary free tier
- ✅ **Fast dashboard loading** - Thumbnails load instantly

---

**Implementation Time:** ~60 minutes
**Maintenance Time:** ~5 minutes/week (checking monitoring dashboards)

You're done! 🎉
