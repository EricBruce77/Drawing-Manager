# n8n Node Configuration - Quick Reference

This is a **copy-paste reference** for configuring each node in your Cloudinary PDF thumbnail workflow.

---

## 🔀 Node 5: IF - Check if PDF

```
Node Type: IF
Node Name: Check if PDF

Condition:
  Value 1: {{ $('Insert Drawing Record').item.json[0].file_type }}
  Operation: equals
  Value 2: pdf

Output:
  - TRUE → Cloudinary nodes (PDFs)
  - FALSE → Edge Function (images)
```

---

## 📥 Node 6: HTTP Request - Get Signed URL for PDF

```
Node Type: HTTP Request
Node Name: Get Signed URL for PDF

Method: POST

URL:
{{ $env.SUPABASE_URL }}/storage/v1/object/sign/drawings/{{ $('Insert Drawing Record').item.json[0].file_url }}

Authentication:
  Type: Generic Credential Type
  Header Name: Authorization
  Header Value: Bearer {{ $env.SUPABASE_SERVICE_KEY }}

Headers:
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "application/json"
}

Body (JSON):
{
  "expiresIn": 3600
}

Options:
  On Error: Continue
  Retry on Fail: true
  Max Retries: 2
```

---

## ☁️ Node 7: HTTP Request - Upload PDF to Cloudinary

```
Node Type: HTTP Request
Node Name: Upload PDF to Cloudinary

Method: POST

URL:
https://api.cloudinary.com/v1_1/{{ $env.CLOUDINARY_CLOUD_NAME }}/upload

Body Content Type: Form-Data

Form Data:
{
  "file": "{{ $('Get Signed URL for PDF').item.json.signedUrl }}",
  "upload_preset": "pdf-thumbnails",
  "folder": "aro-drawings",
  "public_id": "{{ $('Insert Drawing Record').item.json[0].id }}",
  "resource_type": "raw"
}

Options:
  On Error: Continue
  Retry on Fail: true
  Max Retries: 2
  Timeout: 30000
```

---

## 🔗 Node 8: Code - Generate Cloudinary Thumbnail URL

```
Node Type: Code
Node Name: Generate Cloudinary Thumbnail URL
Language: JavaScript

Code:
```
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
```

---

## 📥 Node 9: HTTP Request - Download Thumbnail from Cloudinary

```
Node Type: HTTP Request
Node Name: Download Thumbnail from Cloudinary

Method: GET

URL:
{{ $json.cloudinaryThumbnailUrl }}

Response Format: File

Options:
  Timeout: 20000
```

---

## 📤 Node 10: HTTP Request - Upload Thumbnail to Supabase

```
Node Type: HTTP Request
Node Name: Upload Thumbnail to Supabase

Method: POST

URL:
{{ $env.SUPABASE_URL }}/storage/v1/object/drawings/thumbnails/{{ $json.drawing_id }}.jpg

Authentication:
  Type: Generic Credential Type
  Header Name: Authorization
  Header Value: Bearer {{ $env.SUPABASE_SERVICE_KEY }}

Headers:
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "image/jpeg"
}

Body:
  Content Type: Raw/Custom
  Body: {{ $binary.data }}
```

---

## 🔄 Node 11: HTTP Request - Update Drawing with Thumbnail URL

```
Node Type: HTTP Request
Node Name: Update Drawing with Thumbnail URL

Method: PATCH

URL:
{{ $env.SUPABASE_URL }}/rest/v1/drawings?id=eq.{{ $json.drawing_id }}

Authentication:
  Type: Generic Credential Type
  Header Name: Authorization
  Header Value: Bearer {{ $env.SUPABASE_SERVICE_KEY }}

Headers:
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "application/json",
  "Prefer": "return=representation"
}

Body (JSON):
{
  "thumbnail_url": "thumbnails/{{ $json.drawing_id }}.jpg"
}
```

---

## 🛡️ Error Handler: Code - Log Thumbnail Errors

```
Node Type: Error Trigger
Connected to: Code Node

Error Trigger:
  Activate on error from any node

Code Node (JavaScript):
```
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

return { json: { logged: true, error: error.message } };
```
```

---

## 🌐 Environment Variables Required

Add these to n8n **Settings → Environments**:

```env
# Cloudinary
CLOUDINARY_CLOUD_NAME=dxxxxxxxx
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz

# Supabase (should already exist)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
```

---

## 📊 Workflow Flow Summary

```
[Google Drive Trigger]
        ↓
[Download File]
        ↓
[Upload to Supabase Storage]
        ↓
[Insert Drawing Record]
        ↓
[IF: Check if PDF]
    /           \
  TRUE          FALSE
  (PDF)         (Image)
    |              |
    |              ↓
    |        [Call Edge Function]
    |              |
    ↓              |
[6. Get Signed URL]|
    ↓              |
[7. Upload to Cloudinary]
    ↓              |
[8. Generate Thumbnail URL]
    ↓              |
[9. Download Thumbnail]
    ↓              |
[10. Upload to Supabase]
    ↓              |
[11. Update Database]
    |              |
    └──────┬───────┘
           ↓
    [Workflow Complete]
```

---

## 🎯 Node Connection Order

1. **Google Drive Trigger** → Download File
2. **Download File** → Upload to Supabase Storage
3. **Upload to Supabase** → Insert Drawing Record
4. **Insert Drawing Record** → **IF: Check if PDF**
5. **IF (TRUE)** → Get Signed URL for PDF
6. **Get Signed URL** → Upload PDF to Cloudinary
7. **Upload to Cloudinary** → Generate Cloudinary Thumbnail URL
8. **Generate URL** → Download Thumbnail from Cloudinary
9. **Download Thumbnail** → Upload Thumbnail to Supabase
10. **Upload Thumbnail** → Update Drawing with Thumbnail URL
11. **IF (FALSE)** → Call Edge Function (existing node)

---

## 🔍 Testing Expressions

Use these in the **Expression Editor** to test:

### Test Drawing ID
```javascript
{{ $('Insert Drawing Record').item.json[0].id }}
```

### Test File Type
```javascript
{{ $('Insert Drawing Record').item.json[0].file_type }}
```

### Test Signed URL
```javascript
{{ $('Get Signed URL for PDF').item.json.signedUrl }}
```

### Test Cloudinary Public ID
```javascript
{{ $('Upload PDF to Cloudinary').item.json.public_id }}
```

### Test Thumbnail URL
```javascript
{{ $json.cloudinaryThumbnailUrl }}
```

---

## 📝 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Expression error" | Ensure previous node names match exactly |
| "File not found" | Check `file_url` in database matches storage path |
| "Invalid signature" | Verify Cloudinary API credentials |
| "Timeout" | Increase timeout to 60000 (60 seconds) |
| "Undefined json.public_id" | Check Cloudinary upload succeeded |

---

## ✅ Final Pre-Flight Check

Before activating the workflow:

- [ ] All 11 nodes added and connected
- [ ] All expressions use `{{ }}` syntax correctly
- [ ] Environment variables set and tested
- [ ] Error handling configured on Cloudinary nodes
- [ ] Test execution with manual trigger successful
- [ ] PDF test file produces thumbnail
- [ ] JPG test file still works (regression test)

---

**Ready to implement? Start with [CLOUDINARY_IMPLEMENTATION_CHECKLIST.md](CLOUDINARY_IMPLEMENTATION_CHECKLIST.md)**
