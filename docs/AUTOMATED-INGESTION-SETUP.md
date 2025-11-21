# Automated Drawing Ingestion Setup Guide

This guide walks you through setting up the complete automated drawing ingestion system from Google Drive to your ARO Drawing Manager application.

## Overview

```
Google Drive Folder → n8n Workflow → Supabase → Real-time Updates → Website
```

When you drop a drawing file into your designated Google Drive folder:
1. n8n detects the new file
2. Extracts metadata from the filename
3. Downloads the file and uploads to Supabase Storage
4. Creates a database record with all drawing information
5. The website automatically displays the new drawing (no refresh needed!)

## Step 1: Database Setup

### Run SQL Migrations

In your Supabase SQL Editor, run these commands in order:

```sql
-- 1. Add source tracking fields (if not already done)
ALTER TABLE drawings
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

ALTER TABLE drawings
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN drawings.source IS 'Source of the drawing: manual, google_drive, email, etc.';
COMMENT ON COLUMN drawings.source_metadata IS 'Additional metadata about the source';

CREATE INDEX IF NOT EXISTS idx_drawings_source ON drawings(source);

-- 2. Enable Realtime for the drawings table
ALTER PUBLICATION supabase_realtime ADD TABLE drawings;

-- 3. Verify Realtime is enabled
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
-- drawings table should appear in results
```

### Verify Your Table Structure

Your `drawings` table should have these columns:

```sql
-- Core fields
id                  UUID PRIMARY KEY
part_number         TEXT NOT NULL
revision            TEXT DEFAULT 'A'
title               TEXT
description         TEXT

-- Relationships
customer_id         UUID REFERENCES customers(id)
project_id          UUID REFERENCES projects(id)

-- File information
file_name           TEXT NOT NULL
file_type           TEXT NOT NULL
file_size           BIGINT
file_url            TEXT NOT NULL  -- Supabase Storage path

-- Upload tracking
uploaded_by         UUID REFERENCES auth.users(id)
created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
status              TEXT DEFAULT 'active'
version_number      INTEGER DEFAULT 1

-- Completion tracking
completion_status   TEXT DEFAULT 'pending'
completed_by        UUID
completed_at        TIMESTAMP WITH TIME ZONE
quantity_completed  INTEGER DEFAULT 0
quantity_required   INTEGER

-- New: Source tracking
source              TEXT DEFAULT 'manual'
source_metadata     JSONB DEFAULT '{}'::jsonb
```

## Step 2: Supabase Storage Setup

### Create Storage Bucket (if needed)

```sql
-- Create the drawings bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', false);
```

### Set Up Storage Policies

```sql
-- Allow service role to upload files (for n8n)
CREATE POLICY "Service role can upload drawings"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'drawings');

-- Allow service role to read files (for n8n)
CREATE POLICY "Service role can read drawings"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'drawings');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read drawings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'drawings');

-- Allow authenticated users to upload files (for manual uploads)
CREATE POLICY "Authenticated users can upload drawings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'drawings');
```

## Step 3: Google Drive Setup

### Create Your Drawings Inbox Folder

1. Go to Google Drive
2. Create a new folder called **"ARO Drawings Inbox"**
3. (Optional) Create subfolders for different customers:
   ```
   ARO Drawings Inbox/
   ├── ACME Corp/
   ├── Widget Industries/
   └── General/
   ```
4. Copy the folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Save this ID for n8n configuration

### Set Folder Permissions

- Ensure your n8n Google account has access to this folder
- Share with engineers who will upload drawings

## Step 4: n8n Workflow Setup

### Prerequisites

- n8n instance (self-hosted or cloud)
- Google Drive account connected to n8n
- Supabase project credentials

### Create the Workflow

1. **Open n8n** and create a new workflow
2. **Name it:** "Google Drive to Supabase - Drawing Ingestion"

### Add Nodes

Follow the detailed node setup in [n8n-google-drive-workflow.md](./n8n-google-drive-workflow.md)

**Quick Summary:**
1. Google Drive Trigger (watches folder for new files)
2. Code Node (extracts metadata from filename)
3. Google Drive Download (gets the file)
4. HTTP Request (uploads to Supabase Storage)
5. HTTP Request (creates database record)
6. (Optional) Notification node

### Configure Environment Variables in n8n

Set these in your n8n settings or environment:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```

⚠️ **Important:** Use the **service role key** for n8n operations, as it bypasses RLS policies.

## Step 5: Frontend Updates (Already Done!)

The frontend has been updated with real-time subscriptions:

✅ **DrawingsGrid.jsx** - Automatically refreshes when drawings are added/updated/deleted
✅ **FolderView.jsx** - Also has real-time updates enabled

**How it works:**
- Supabase Realtime broadcasts changes to the `drawings` table
- React components subscribe to these changes
- New drawings appear immediately without manual refresh

**Console logs:**
When a drawing is added via Google Drive, you'll see:
```
New drawing added: { id: '...', part_number: '...', ... }
```

## Step 6: Testing the Complete Flow

### Test Checklist

1. **Prepare a test drawing file**
   - Name it: `TEST001_A_Test-Bracket.pdf`
   - This follows the format: `PARTNUMBER_REVISION_TITLE.ext`

2. **Upload to Google Drive**
   - Drop the file into your "ARO Drawings Inbox" folder
   - Wait 5-10 seconds for n8n to detect it

3. **Check n8n Workflow**
   - Open n8n workflow execution history
   - Verify the workflow ran successfully
   - Check each node for errors

4. **Verify Supabase**
   - Open Supabase Table Editor → drawings table
   - Look for your new drawing with:
     - `part_number = 'TEST001'`
     - `revision = 'A'`
     - `title = 'Test Bracket'`
     - `source = 'google_drive'`
   - Open Storage → drawings bucket
   - Verify the file was uploaded

5. **Check the Website**
   - Open your ARO Drawing Manager app
   - Go to "All Drawings" dashboard
   - The test drawing should appear automatically!
   - Click to view, download, edit, etc.

## Step 7: Production Filename Guidelines

### Recommended Format

```
PARTNUMBER_REVISION_TITLE.ext
```

**Examples:**
- `12345_A_Mounting-Bracket.pdf`
- `ABC-001_B_Main-Assembly.dwg`
- `WIDGET-50_C_Cover-Plate.pdf`
- `PUMP-HOUSING_A_Industrial-Pump.dxf`

**Rules:**
- Use **underscores `_`** to separate: part number, revision, title
- Use **hyphens `-`** for spaces within the title
- Revision defaults to `'A'` if not provided
- Supported extensions: `.pdf`, `.dwg`, `.dxf`, `.png`, `.jpg`, `.jpeg`

### Example Filenames

| Filename | Part Number | Revision | Title |
|----------|-------------|----------|-------|
| `SHAFT-100_B_Drive-Shaft.pdf` | SHAFT-100 | B | Drive Shaft |
| `PLATE_A_Cover.dwg` | PLATE | A | Cover |
| `12345.pdf` | 12345 | A | (none) |
| `ABC-500_C.pdf` | ABC-500 | C | (none) |

## Troubleshooting

### New drawings not appearing in the app

**Check:**
1. Is Realtime enabled on the `drawings` table?
   ```sql
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```
2. Open browser console - do you see "New drawing added" logs?
3. Hard refresh the page (Ctrl+Shift+R)

### n8n workflow failing

**Common issues:**
- **Google Drive authentication expired** → Reconnect Google account in n8n
- **Supabase service key incorrect** → Check environment variables
- **File too large** → Supabase default limit is 50MB, increase if needed
- **Invalid filename format** → Check parsing logic in Code node

### Files uploading but no database record

**Check:**
- Supabase service role key has permissions
- RLS policies allow service role to INSERT
- Required fields are provided (part_number, file_url, etc.)
- Check n8n logs for error messages

### Database record created but file missing

**Check:**
- Storage bucket "drawings" exists
- Storage policies allow service role to upload
- File path in `file_url` matches Storage bucket structure
- Check n8n HTTP Request node for upload errors

## Advanced Features

### Auto-Assign Customer Based on Folder

Modify the n8n Code node to detect which subfolder the file is in:

```javascript
const folderName = $input.item.json.parents?.[0];

// Map folder IDs to customer IDs
const folderCustomerMap = {
  'FOLDER_ID_ACME': 'CUSTOMER_ID_ACME',
  'FOLDER_ID_WIDGET': 'CUSTOMER_ID_WIDGET'
};

const customerId = folderCustomerMap[folderName] || null;
```

### Email Notifications

Add a final node to send emails when drawings are ingested:

```
Node: Send Email (or Slack/Teams)
To: engineering@yourcompany.com
Subject: New drawing uploaded: {{ $json.part_number }}
Body:
  Part Number: {{ $json.part_number }}
  Revision: {{ $json.revision }}
  Title: {{ $json.title }}
  View: https://your-app.com/drawings
```

### Duplicate Detection

Before inserting, check for existing drawings:

```javascript
// In n8n HTTP Request node
// First check for duplicates
GET https://YOUR_PROJECT.supabase.co/rest/v1/drawings
  ?part_number=eq.{{ $json.part_number }}
  &revision=eq.{{ $json.revision }}
  &select=id

// If results exist, skip or update instead of insert
```

## Monitoring and Logs

### n8n Execution History
- Check failed workflows
- View execution time
- See error messages

### Supabase Logs
- Database → Logs
- Filter by table: `drawings`
- Look for INSERT events

### Browser Console
- Open DevTools (F12)
- Console tab
- Look for "New drawing added" messages

## Security Best Practices

1. **Never expose service role key in client-side code**
   - Only use in n8n (server-side)
   - Use anon key in frontend

2. **Enable RLS policies**
   - Control who can view/edit drawings
   - Use role-based access (engineers vs machinists)

3. **Validate filenames**
   - Sanitize input to prevent injection
   - Limit file types and sizes

4. **Audit trail**
   - `source` field tracks origin
   - `source_metadata` stores Google Drive file ID
   - `uploaded_by` tracks who manually uploaded

## Summary

You now have a fully automated drawing ingestion system:

✅ Drop file in Google Drive
✅ n8n automatically processes it
✅ File uploaded to Supabase Storage
✅ Database record created with metadata
✅ Website displays new drawing in real-time
✅ No manual intervention required!

## Next Steps

1. Run the SQL migrations
2. Set up your Google Drive folder
3. Create the n8n workflow
4. Test with a sample file
5. Share the folder with your team
6. Monitor the first few uploads
7. Refine filename parsing as needed

For detailed n8n workflow setup, see [n8n-google-drive-workflow.md](./n8n-google-drive-workflow.md)
