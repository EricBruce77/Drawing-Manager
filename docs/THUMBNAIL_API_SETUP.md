# Thumbnail Generation API Setup

This guide will help you deploy a serverless thumbnail generation API that your n8n workflow can call.

## Option 1: Deploy to Vercel (Recommended - Free)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
cd api
vercel login
vercel deploy
```

### Step 3: Get your API endpoint
After deployment, Vercel will provide a URL like:
```
https://your-project.vercel.app/api/generate-thumbnail
```

## Option 2: Deploy to Netlify (Free)

### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 2: Create netlify.toml
Create `netlify.toml` in project root:
```toml
[build]
  functions = "api"

[functions]
  node_bundler = "esbuild"
```

### Step 3: Deploy
```bash
netlify login
netlify deploy --prod
```

## Option 3: Use Supabase Edge Functions (If you have Pro plan)

### Step 1: Install Supabase CLI
```bash
npm install supabase --save-dev
npx supabase login
```

### Step 2: Create Edge Function
```bash
npx supabase functions new generate-thumbnail
```

### Step 3: Deploy
```bash
npx supabase functions deploy generate-thumbnail
```

## Testing Your API

Once deployed, test with curl:

```bash
curl -X POST https://your-api-url/api/generate-thumbnail \
  -H "Content-Type: application/json" \
  -d '{
    "fileUrl": "https://example.com/sample.pdf",
    "fileType": "application/pdf"
  }'
```

Expected response:
```json
{
  "success": true,
  "thumbnail": "base64-encoded-jpeg-string",
  "mimeType": "image/jpeg"
}
```

## Add to n8n Workflow

Once deployed, add these nodes to your n8n workflow:

### 1. After "Upload to Supabase Storage" node, add HTTP Request node

**Node: Generate Thumbnail**
- **Method**: POST
- **URL**: `https://your-api-url/api/generate-thumbnail`
- **Headers**:
  - `Content-Type`: `application/json`
- **Body**:
```json
{
  "fileUrl": "{{ $('Upload to Supabase Storage').item.json.signedUrl }}",
  "fileType": "{{ $json.mime_type }}"
}
```

### 2. Add Code node to convert base64 to binary

**Node: Convert to Binary**
```javascript
const thumbnailBase64 = $input.item.json.thumbnail
const thumbnailBuffer = Buffer.from(thumbnailBase64, 'base64')

return {
  json: $input.item.json,
  binary: {
    thumbnail: {
      data: thumbnailBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      fileName: `thumbnail-${Date.now()}.jpg`
    }
  }
}
```

### 3. Add HTTP Request to upload thumbnail

**Node: Upload Thumbnail to Supabase**
- **Method**: POST
- **URL**: `https://YOUR_PROJECT.supabase.co/storage/v1/object/drawings/thumbnails/{{ Date.now() }}-{{ $('Extract Metadata').item.json.part_number }}.jpg`
- **Authentication**: Bearer Token
  - **Token**: `YOUR_SUPABASE_SERVICE_ROLE_KEY`
- **Headers**:
  - `apikey`: `YOUR_SUPABASE_ANON_KEY`
  - `Content-Type`: `image/jpeg`
- **Send Body**: Yes
- **Body Content Type**: n8n Binary File
- **Input Data Field Name**: `thumbnail`

### 4. Update Supabase Insert node

Add `thumbnail_url` field:
```javascript
thumbnail_url: thumbnails/{{ Date.now() }}-{{ $json.part_number }}.jpg
```

## Updated Workflow Flow

```
[Google Drive Trigger]
    ↓
[Extract Metadata]
    ↓
[Download File]
    ↓
[Upload to Supabase Storage]
    ↓
[Generate Signed URL] ← Get signed URL for thumbnail API
    ↓
[Generate Thumbnail] ← Call your API
    ↓
[Convert to Binary]
    ↓
[Upload Thumbnail to Supabase]
    ↓
[Insert to Database] ← Include thumbnail_url
```

## Troubleshooting

### API returns 500 error
- Check that file URL is accessible
- Verify file type is supported (PDF, PNG, JPG, JPEG)
- Check serverless function logs

### Thumbnail not appearing in dashboard
- Verify thumbnail was uploaded to `thumbnails/` folder in Supabase Storage
- Check that `thumbnail_url` column in database has the correct path
- Ensure Storage RLS policies allow reading from `thumbnails/` folder

### Large files timing out
- Increase serverless function timeout (default is usually 10s)
- Consider using a queue for large files
- Or skip thumbnail generation for files > 10MB

## Alternative: Use Existing API Service

If you don't want to deploy your own API, you can use a third-party service:

### CloudConvert (Free tier: 25 conversions/day)
```
https://cloudconvert.com/api/v2
```

### PDF.co (Free tier: 100 API calls/month)
```
https://api.pdf.co/v1/pdf/convert/to/jpg
```

Check their documentation for API details.
