# n8n Google Drive to Supabase Workflow

This document provides complete instructions for setting up an n8n workflow that automatically ingests drawings from Google Drive to your Supabase database.

## Overview

When a new file is added to a designated Google Drive folder, this workflow will:
1. Detect the new file
2. Extract or parse drawing metadata (part number, revision, etc.)
3. Download the file from Google Drive
4. Upload the file to Supabase Storage
5. Create a database record with all drawing information
6. The website will automatically display the new drawing

## Workflow Structure

### 1. Google Drive Trigger
**Node Type:** `Google Drive Trigger`
**Configuration:**
- **Trigger Event:** `File Created`
- **Watch Folder:** Select your designated drawings folder
- **Simplified:** Enable to get file data directly

### 2. Extract Metadata from Filename
**Node Type:** `Code` (JavaScript)
**Purpose:** Parse filename to extract drawing information

```javascript
// Expected filename format: PARTNUMBER_REV_TITLE.ext
// Example: "12345_A_Mounting-Bracket.pdf"

const file = $input.item.json;
const fileName = file.name;
const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));

// Parse filename
const parts = fileNameWithoutExt.split('_');

// Extract data
const partNumber = parts[0] || 'UNKNOWN';
const revision = parts[1] || 'A';
const title = parts.slice(2).join(' ').replace(/-/g, ' ') || null;

// Get file extension
const fileExt = fileName.split('.').pop().toLowerCase();

return {
  json: {
    // Original file data
    drive_file_id: file.id,
    drive_file_name: file.name,
    mime_type: file.mimeType,
    file_size: file.size,
    created_time: file.createdTime,

    // Parsed metadata
    part_number: partNumber,
    revision: revision,
    title: title,
    file_type: fileExt,

    // For Supabase
    status: 'active',
    source: 'google_drive',
    source_metadata: {
      drive_file_id: file.id,
      drive_folder: file.parents?.[0] || null,
      original_filename: file.name
    }
  }
};
```

**Alternative: Use AI to Extract Metadata**
If filenames are inconsistent, add an OpenAI/Anthropic node:

```javascript
// After downloading the file, use AI to analyze it
// This is optional but can improve accuracy

const prompt = `Analyze this technical drawing filename and extract:
1. Part number
2. Revision (default to 'A' if not found)
3. Descriptive title

Filename: ${fileName}

Return JSON format:
{
  "part_number": "...",
  "revision": "...",
  "title": "..."
}`;
```

### 3. Download File from Google Drive
**Node Type:** `Google Drive`
**Operation:** `Download`
**Configuration:**
- **File ID:** `{{ $json.drive_file_id }}`
- **Options:**
  - Binary Property: `data`

### 4. Upload to Supabase Storage
**Node Type:** `HTTP Request`
**Purpose:** Upload file to Supabase Storage bucket

**Configuration:**
- **Method:** `POST`
- **URL:** `https://YOUR_PROJECT.supabase.co/storage/v1/object/drawings/{{ $now.format('X') }}-{{ $json.drive_file_name }}`
- **Authentication:** `Generic Credential Type`
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
- **Headers:**
  ```
  apikey: YOUR_SUPABASE_ANON_KEY
  Content-Type: {{ $json.mime_type }}
  ```
- **Send Body:** Yes
- **Body Content Type:** `Raw/Custom`
- **Body:** `={{ $binary.data }}`

**Response:**
Save the returned path for the database insert.

### 5. Insert Drawing Record to Supabase
**Node Type:** `HTTP Request`
**Purpose:** Create database entry

**Configuration:**
- **Method:** `POST`
- **URL:** `https://YOUR_PROJECT.supabase.co/rest/v1/drawings`
- **Authentication:** `Generic Credential Type`
  - **Header Name:** `Authorization`
  - **Header Value:** `Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY`
- **Headers:**
  ```
  apikey: YOUR_SUPABASE_ANON_KEY
  Content-Type: application/json
  Prefer: return=representation
  ```
- **Send Body:** Yes
- **Body Content Type:** `JSON`
- **JSON:**

```json
{
  "part_number": "={{ $('Extract Metadata').item.json.part_number }}",
  "revision": "={{ $('Extract Metadata').item.json.revision }}",
  "title": "={{ $('Extract Metadata').item.json.title }}",
  "description": null,
  "customer_id": null,
  "project_id": null,
  "file_name": "={{ $('Extract Metadata').item.json.drive_file_name }}",
  "file_type": "={{ $('Extract Metadata').item.json.file_type }}",
  "file_size": {{ $('Extract Metadata').item.json.file_size }},
  "file_url": "={{ $json.path }}",
  "uploaded_by": null,
  "status": "active",
  "source": "google_drive",
  "source_metadata": {{ JSON.stringify($('Extract Metadata').item.json.source_metadata) }}
}
```

### 6. (Optional) Link to Customer/Project
**Node Type:** `Code`
**Purpose:** Auto-assign customer/project based on folder structure or filename patterns

```javascript
// Example: If folder name matches customer name
const folderName = $('Google Drive Trigger').item.json.parents?.[0];

// Query Supabase to find matching customer
// Then update the drawing record with customer_id and/or project_id
```

### 7. (Optional) Send Notification
**Node Type:** `Slack` / `Email` / `Webhook`
**Purpose:** Notify team when new drawing is ingested

```
New drawing uploaded:
Part Number: {{ $('Extract Metadata').item.json.part_number }}
Revision: {{ $('Extract Metadata').item.json.revision }}
Title: {{ $('Extract Metadata').item.json.title }}
View in app: https://your-app.com/drawings
```

## Setup Instructions

### Step 1: Create Google Drive Folder
1. Create a folder in Google Drive called "ARO Drawings Inbox"
2. Note the folder ID from the URL

### Step 2: Set Up Supabase
1. Run the SQL migration:
   ```bash
   # In Supabase SQL Editor
   # Run: add-drawing-source-field.sql
   ```

2. Ensure your Supabase Storage bucket "drawings" exists and has proper policies:
   ```sql
   -- Allow service role to upload
   CREATE POLICY "Service role can upload drawings"
   ON storage.objects FOR INSERT
   TO service_role
   WITH CHECK (bucket_id = 'drawings');

   -- Allow authenticated users to read
   CREATE POLICY "Authenticated users can read drawings"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'drawings');
   ```

### Step 3: Create n8n Workflow
1. In n8n, create a new workflow
2. Add each node as documented above
3. Connect your Google Drive account
4. Add Supabase credentials (service role key for uploads)
5. Test with a sample file

### Step 4: Test the Workflow
1. Upload a test file to your Google Drive folder
2. Format: `TEST001_A_Test-Drawing.pdf`
3. Verify the workflow executes
4. Check Supabase to confirm:
   - File appears in Storage bucket
   - Record appears in drawings table
   - Website displays the drawing

## Filename Format Guidelines

**Recommended Format:**
```
PARTNUMBER_REVISION_TITLE.ext
```

**Examples:**
- `12345_A_Mounting-Bracket.pdf`
- `ABC-001_B_Main-Assembly.dwg`
- `WIDGET-50_C_Cover-Plate.pdf`

**Notes:**
- Use underscores `_` to separate main components
- Use hyphens `-` for spaces in title
- Revision defaults to 'A' if not specified
- Supported extensions: .pdf, .dwg, .dxf, .png, .jpg, .jpeg

## Advanced Features

### Auto-Customer Assignment
Use folder structure to automatically assign customers:
```
ARO Drawings Inbox/
  ├── ACME Corp/          → customer_id for "ACME Corp"
  ├── Widget Industries/  → customer_id for "Widget Industries"
  └── General/            → No customer assigned
```

### AI-Powered Metadata Extraction
Use OpenAI Vision or Anthropic Claude to:
1. Read text from PDF drawings
2. Extract part numbers, titles, revision info
3. Identify drawing type (assembly, detail, etc.)

### Duplicate Detection
Add a check to prevent duplicate uploads:
```javascript
// Query Supabase for existing part_number + revision
const { data } = await supabase
  .from('drawings')
  .select('id')
  .eq('part_number', partNumber)
  .eq('revision', revision)
  .single();

if (data) {
  // Handle duplicate: skip, update, or create new version
}
```

## Troubleshooting

### Files Not Triggering
- Verify Google Drive trigger is active
- Check folder permissions
- Ensure n8n has access to the folder

### Upload Failures
- Verify Supabase service role key is correct
- Check Storage bucket exists and has proper RLS policies
- Ensure file size is within Supabase limits (50MB default)

### Database Insert Errors
- Check all required fields are provided
- Verify user_id exists if using uploaded_by
- Check RLS policies allow service role to insert

## Environment Variables for n8n

Set these in your n8n environment:
```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
```

## Webhook Alternative

If you prefer webhooks instead of triggers:

1. **n8n Webhook Node** instead of Google Drive Trigger
2. **Google Drive File Watch** → Sends webhook when file changes
3. Webhook URL: `https://your-n8n-instance.com/webhook/drawing-upload`

This gives you more control but requires additional Google Apps Script setup.
