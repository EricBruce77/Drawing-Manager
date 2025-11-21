# n8n Supabase Node - Quick Start Guide

This is a simplified guide for setting up the Google Drive to Supabase workflow using native n8n nodes.

## Prerequisites

- n8n instance (cloud or self-hosted)
- Google Drive account
- Supabase project with drawings table
- Google Drive folder ID for your "ARO Drawings Inbox"

## Node Setup (5 Nodes Total)

### Node 1: Google Drive Trigger

**Type:** `Google Drive Trigger`

**Settings:**
- Event: `File Created`
- Folder: Select your "ARO Drawings Inbox" folder
- Watch for: `All files`
- Simplified: `Yes`

**What it does:** Automatically detects when a new file is added to your folder.

---

### Node 2: Extract Metadata (Code)

**Type:** `Code` (JavaScript)

**Code:**
```javascript
// Expected filename: PARTNUMBER_REV_TITLE.ext
// Example: "12345_A_Mounting-Bracket.pdf"

const file = $input.item.json;
const fileName = file.name;
const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));

// Parse filename (split by underscore)
const parts = fileNameWithoutExt.split('_');

// Extract data
const partNumber = parts[0] || 'UNKNOWN';
const revision = parts[1] || 'A';
const title = parts.slice(2).join(' ').replace(/-/g, ' ') || null;

// Get file extension
const fileExt = fileName.split('.').pop().toLowerCase();

// Generate unique storage filename
const storageFileName = `${Date.now()}-${fileName}`;

return {
  json: {
    // Original file data
    drive_file_id: file.id,
    drive_file_name: file.name,
    mime_type: file.mimeType,
    file_size: parseInt(file.size),
    created_time: file.createdTime,

    // Parsed metadata
    part_number: partNumber,
    revision: revision,
    title: title,
    file_type: fileExt,

    // For storage
    storage_file_name: storageFileName,
    storage_path: storageFileName,

    // For database
    status: 'active',
    source: 'google_drive',
    source_metadata: {
      drive_file_id: file.id,
      drive_folder: file.parents?.[0] || null,
      original_filename: file.name,
      ingested_at: new Date().toISOString()
    }
  }
};
```

**What it does:** Parses the filename to extract part number, revision, and title.

---

### Node 3: Google Drive Download

**Type:** `Google Drive`

**Settings:**
- Operation: `Download`
- File ID: `{{ $json.drive_file_id }}`
- Binary Property: `data`

**What it does:** Downloads the file from Google Drive.

---

### Node 4: Upload to Supabase Storage (HTTP Request)

**Type:** `HTTP Request`

> Note: Currently, n8n's Supabase node doesn't support Storage operations, so we use HTTP Request for this step.

**Settings:**
- Method: `POST`
- URL: `https://YOUR_PROJECT.supabase.co/storage/v1/object/drawings/{{ $('Extract Metadata').item.json.storage_file_name }}`
- Authentication: `Generic Credential Type`
  - Header Name: `Authorization`
  - Header Value: `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
- Send Headers: `Yes`
  - `apikey`: `YOUR_SUPABASE_ANON_KEY`
  - `Content-Type`: `{{ $('Extract Metadata').item.json.mime_type }}`
- Send Body: `Yes`
- Body Content Type: `Raw/Custom`
- Body: `={{ $binary.data }}`

**What it does:** Uploads the file to your Supabase Storage bucket named "drawings".

---

### Node 5: Insert to Database (Supabase)

**Type:** `Supabase` ⭐ **Use native Supabase node here!**

**Credentials Setup (one-time):**
1. Click "Create New Credential"
2. Name: "Supabase ARO Drawing Manager"
3. Host: `https://YOUR_PROJECT.supabase.co`
4. Service Role Secret: `YOUR_SUPABASE_SERVICE_ROLE_KEY`
5. Save

**Settings:**
- Operation: `Insert`
- Table: `drawings`

**Fields Mapping:**

| Field | Expression | Type |
|-------|------------|------|
| `part_number` | `{{ $('Extract Metadata').item.json.part_number }}` | String |
| `revision` | `{{ $('Extract Metadata').item.json.revision }}` | String |
| `title` | `{{ $('Extract Metadata').item.json.title }}` | String |
| `file_name` | `{{ $('Extract Metadata').item.json.drive_file_name }}` | String |
| `file_type` | `{{ $('Extract Metadata').item.json.file_type }}` | String |
| `file_size` | `{{ $('Extract Metadata').item.json.file_size }}` | Number |
| `file_url` | `{{ $('Extract Metadata').item.json.storage_path }}` | String |
| `status` | `active` | String |
| `source` | `google_drive` | String |
| `source_metadata` | `{{ $('Extract Metadata').item.json.source_metadata }}` | Object |

**Options:**
- Return Fields: `*` (returns the inserted row)

**What it does:** Creates a new database record in your drawings table.

---

## Workflow Flow Chart

```
┌─────────────────────┐
│  File added to      │
│  Google Drive       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Google Drive       │
│  Trigger            │
│  (Detects file)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Extract Metadata   │
│  (Parse filename)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Google Drive       │
│  Download           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  HTTP Request       │
│  (Upload to         │
│   Supabase Storage) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Supabase Node      │
│  (Insert database   │
│   record)           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Drawing appears in │
│  your app! ✨       │
└─────────────────────┘
```

## Configuration Checklist

### Before You Start

- [ ] Google Drive folder created ("ARO Drawings Inbox")
- [ ] Folder ID copied from URL
- [ ] Supabase service role key copied
- [ ] Supabase anon key copied
- [ ] SQL migrations run ([add-drawing-source-field.sql](add-drawing-source-field.sql))
- [ ] Realtime enabled ([enable-realtime.sql](enable-realtime.sql))

### In n8n

- [ ] Google Drive account connected
- [ ] Supabase credentials created
- [ ] All 5 nodes added and connected
- [ ] Node names match the expressions (especially 'Extract Metadata')
- [ ] Service role key added to HTTP Request node
- [ ] Workflow activated

### Testing

- [ ] Test file prepared: `TEST001_A_Test-Drawing.pdf`
- [ ] File uploaded to Google Drive folder
- [ ] Workflow executed successfully
- [ ] File appears in Supabase Storage bucket
- [ ] Record created in drawings table
- [ ] Drawing visible in your app

## Common Issues

### "Invalid JSON" in Supabase Node

**Problem:** source_metadata field is showing as text instead of object

**Solution:** In the Supabase node, for the `source_metadata` field:
- Click the field
- Select "Expression" mode
- Use: `{{ $('Extract Metadata').item.json.source_metadata }}`
- Make sure it's set as type "Object" or "JSON"

### File Upload Fails

**Problem:** Storage upload returns 401 or 403

**Solution:**
- Verify service role key is correct
- Check Storage bucket "drawings" exists
- Verify Storage RLS policies allow service role to INSERT

### Database Insert Fails

**Problem:** "violates not-null constraint" or "permission denied"

**Solution:**
- Check required fields are all provided (part_number, file_name, file_url, etc.)
- Verify RLS policies allow service role to INSERT
- Make sure uploaded_by is NULL or a valid UUID

### Workflow Not Triggering

**Problem:** Adding files to Google Drive doesn't trigger workflow

**Solution:**
- Make sure workflow is "Active" (toggle in top right)
- Verify Google Drive trigger is watching the correct folder
- Check n8n executions tab for errors
- Try "Test workflow" button with a manual trigger

## Tips for Success

### Filename Best Practices

**Good filenames:**
- `12345_A_Mounting-Bracket.pdf` → Part: 12345, Rev: A, Title: Mounting Bracket
- `ABC-001_B_Main-Assembly.dwg` → Part: ABC-001, Rev: B, Title: Main Assembly
- `WIDGET_C.pdf` → Part: WIDGET, Rev: C, Title: (none)

**Bad filenames:**
- `drawing (1).pdf` → Part: "drawing (1)", Rev: A, Title: (none)
- `final-FINAL-v2.dwg` → Part: "final-FINAL-v2", Rev: A, Title: (none)

Train your team to use consistent naming!

### Monitoring

Watch the n8n Executions tab to see:
- How many files have been processed
- Any errors that occurred
- Processing time per file

### Notifications

Add a 6th node for notifications:

**Node Type:** `Slack` / `Email` / `Discord`

**Message:**
```
✅ New drawing uploaded!
📋 Part Number: {{ $('Extract Metadata').item.json.part_number }}
📝 Revision: {{ $('Extract Metadata').item.json.revision }}
🏷️ Title: {{ $('Extract Metadata').item.json.title }}
🔗 View: https://your-app.com/drawings
```

## Next Steps

Once this is working:

1. **Auto-assign customers** - Use folder structure to map to customer_id
2. **AI metadata extraction** - Use OpenAI/Claude to extract data from PDFs
3. **Duplicate detection** - Check for existing part_number + revision
4. **Version control** - Automatically increment version_number for duplicates
5. **Thumbnail generation** - Generate preview images for drawings

## Environment Variables (Optional)

If using self-hosted n8n, you can set these as environment variables:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```

Then reference them in nodes as: `{{ $env.SUPABASE_URL }}`

## Support

If you encounter issues:
1. Check the n8n Executions tab for error details
2. Review Supabase logs (Database → Logs)
3. Test each node individually using "Execute Node" button
4. Check browser console for real-time subscription logs

Your drawings will appear in the app automatically thanks to the real-time subscriptions we set up! 🎉
