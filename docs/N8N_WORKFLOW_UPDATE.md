# n8n Workflow Update - Add Thumbnail Generation

Your thumbnail generation API is deployed at:
```
https://api-egikgnnzc-erics-projects-bc246aff.vercel.app/api/generate-thumbnail
```

## Update Your Google Drive → Supabase Workflow

Add these nodes to your existing n8n workflow to generate thumbnails for drawings uploaded from Google Drive.

### Current Workflow
```
[Google Drive Trigger]
    ↓
[Extract Metadata]
    ↓
[Download File]
    ↓
[Upload to Supabase Storage]
    ↓
[Insert to Database]
```

### Updated Workflow (Add These Nodes)
```
[Google Drive Trigger]
    ↓
[Extract Metadata]
    ↓
[Download File]
    ↓
[Upload to Supabase Storage]
    ↓
[Generate Signed URL] ← NEW
    ↓
[Generate Thumbnail] ← NEW
    ↓
[Convert to Binary] ← NEW
    ↓
[Upload Thumbnail to Supabase] ← NEW
    ↓
[Insert to Database] ← UPDATED (add thumbnail_url field)
```

---

## Step-by-Step Instructions

### 1. Add "Generate Signed URL" Node (HTTP Request)

**After**: Upload to Supabase Storage node

**Settings**:
- **Method**: POST
- **URL**: `https://YOUR_PROJECT.supabase.co/storage/v1/object/sign/drawings/{{ $json.file_url }}`
- **Authentication**: Bearer Token
  - **Token**: `YOUR_SUPABASE_SERVICE_ROLE_KEY`
- **Headers**:
  - `apikey`: `YOUR_SUPABASE_ANON_KEY`
  - `Content-Type`: `application/json`
- **Body** (JSON):
  ```json
  {
    "expiresIn": 3600
  }
  ```

**What this does**: Creates a temporary signed URL that the thumbnail API can access.

---

### 2. Add "Generate Thumbnail" Node (HTTP Request)

**After**: Generate Signed URL node

**Settings**:
- **Method**: POST
- **URL**: `https://api-egikgnnzc-erics-projects-bc246aff.vercel.app/api/generate-thumbnail`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-vercel-protection-bypass`: `YOUR_VERCEL_BYPASS_TOKEN` ← **Use the token you copied**
- **Body** (JSON):
  ```json
  {
    "fileUrl": "{{ $('Generate Signed URL').item.json.signedURL }}",
    "fileType": "{{ $('Upload to Supabase Storage').item.json.mime_type }}"
  }
  ```

**Important**: Replace `YOUR_VERCEL_BYPASS_TOKEN` with the Protection Bypass token you just copied from Vercel.

**What this does**: Calls your serverless function to generate a thumbnail and returns it as base64.

---

### 3. Add "Convert to Binary" Node (Code)

**After**: Generate Thumbnail node

**Code**:
```javascript
// Get thumbnail data from API response
const thumbnailBase64 = $input.item.json.thumbnail
const fileUrl = $('Upload to Supabase Storage').item.json.file_url
const fileName = fileUrl.split('/').pop().replace(/\.[^/.]+$/, '')

// Convert base64 to binary
return {
  json: {
    thumbnail_filename: `thumbnails/${Date.now()}-${fileName}.jpg`,
    original_file_url: fileUrl
  },
  binary: {
    thumbnail: {
      data: thumbnailBase64,
      mimeType: 'image/jpeg',
      fileName: `thumbnail-${Date.now()}.jpg`
    }
  }
}
```

**What this does**: Converts the base64 thumbnail to binary format that Supabase can accept.

---

### 4. Add "Upload Thumbnail to Supabase" Node (HTTP Request)

**After**: Convert to Binary node

**Settings**:
- **Method**: POST
- **URL**: `https://YOUR_PROJECT.supabase.co/storage/v1/object/drawings/{{ $json.thumbnail_filename }}`
- **Authentication**: Bearer Token
  - **Token**: `YOUR_SUPABASE_SERVICE_ROLE_KEY`
- **Headers**:
  - `apikey`: `YOUR_SUPABASE_ANON_KEY`
  - `Content-Type`: `image/jpeg`
- **Send Body**: Yes
- **Body Content Type**: n8n Binary File
- **Input Data Field Name**: `thumbnail`

**What this does**: Uploads the thumbnail image to Supabase Storage in the `thumbnails/` folder.

---

### 5. Update "Insert to Database" Node

**Modify your existing Insert node** to include the `thumbnail_url` field:

Add this field to your INSERT query:
```javascript
thumbnail_url: {{ $('Convert to Binary').item.json.thumbnail_filename }}
```

**Full example** (update your existing columns):
```javascript
{
  part_number: {{ $json.part_number }},
  revision: {{ $json.revision }},
  title: {{ $json.title }},
  file_name: {{ $json.file_name }},
  file_type: {{ $json.file_type }},
  file_url: {{ $json.file_url }},
  thumbnail_url: {{ $('Convert to Binary').item.json.thumbnail_filename }},  // ← ADD THIS
  sources: 'google_drive',
  status: 'active'
}
```

**What this does**: Stores the thumbnail path in the database so your dashboard can display it.

---

## Error Handling (Optional but Recommended)

Add an **"On Error"** workflow to handle cases where thumbnail generation fails:

1. Add error handling to the "Generate Thumbnail" node
2. If it fails, insert the drawing without a thumbnail (set `thumbnail_url` to `null`)
3. Log the error for debugging

---

## Testing Your Workflow

1. **Trigger a test**: Upload a new PDF or image to your Google Drive folder
2. **Check n8n execution log**: Verify all nodes execute successfully
3. **Check Supabase Storage**: Look in the `thumbnails/` folder for the generated thumbnail
4. **Check your dashboard**: The drawing should now display with a thumbnail preview

---

## Troubleshooting

### API returns 401/403 error
- Verify you added the `x-vercel-protection-bypass` header with your bypass token
- Check that the token is correct (no extra spaces)

### Thumbnail not appearing in dashboard
- Verify the thumbnail was uploaded to Supabase Storage (`thumbnails/` folder)
- Check that `thumbnail_url` column has the correct path (e.g., `thumbnails/12345-filename.jpg`)
- Verify your Storage RLS policies allow reading from `thumbnails/` folder

### API returns 500 error
- Check that the signed URL is valid and accessible
- Verify the file type is supported (PDF, PNG, JPG, JPEG)
- Check Vercel function logs: https://vercel.com/erics-projects-bc246aff/api

### Timeout errors
- Large PDFs may take longer to process
- Consider increasing n8n node timeout settings
- The Vercel function has a 60-second timeout

---

## Next Steps

After updating your n8n workflow:

1. Test with a new file upload from Google Drive
2. Verify thumbnails appear in your dashboard
3. Optional: Run a backfill script for existing drawings without thumbnails

---

## API Endpoint Reference

**Endpoint**: `https://api-egikgnnzc-erics-projects-bc246aff.vercel.app/api/generate-thumbnail`

**Method**: POST

**Headers**:
```
Content-Type: application/json
x-vercel-protection-bypass: YOUR_BYPASS_TOKEN
```

**Request Body**:
```json
{
  "fileUrl": "https://example.com/file.pdf",
  "fileType": "application/pdf"
}
```

**Response** (Success):
```json
{
  "success": true,
  "thumbnail": "base64-encoded-jpeg-string...",
  "mimeType": "image/jpeg",
  "size": 12345
}
```

**Response** (Error):
```json
{
  "error": "Failed to generate thumbnail",
  "message": "Error details..."
}
```
