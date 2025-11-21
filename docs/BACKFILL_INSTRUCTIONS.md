# Thumbnail Backfill Script

This script generates thumbnails for existing drawings that don't have them (e.g., files uploaded via n8n Google Drive workflow).

## Prerequisites

1. Node.js installed (v18 or higher)
2. Supabase Service Role Key (for admin access)

## Setup

### 1. Get Your Supabase Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key!)
4. **⚠️ IMPORTANT**: Keep this key secret - it has admin access to your database

### 2. Create .env File

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and add your keys:

```env
VITE_SUPABASE_URL=https://wwbpnuembvfurpapwror.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key  # ← Add this!
```

### 3. Install Dependencies (if not already done)

```bash
npm install
```

## Running the Script

### Option 1: Using npm script (recommended)

```bash
npm run backfill-thumbnails
```

### Option 2: Run directly

```bash
node scripts/backfill-thumbnails.js
```

## What It Does

The script will:

1. ✅ Find all drawings without `thumbnail_url`
2. ⬇️ Download each file from Supabase Storage
3. 🖼️ Generate a 400px-wide JPEG thumbnail
4. 📤 Upload thumbnail to `thumbnails/` folder in Storage
5. 💾 Update database with thumbnail URL

## Example Output

```
🚀 Starting thumbnail backfill process...

🔍 Finding drawings without thumbnails...
📊 Found 15 drawings without thumbnails

════════════════════════════════════════════════════════════

[1/15]
📋 Processing: template-drawing.pdf (ID: 123)
  ⬇️ Downloading file...
  📄 Generating PDF thumbnail...
  📤 Uploading thumbnail: thumbnails/1732045678-template-drawing.jpg
  💾 Updating database...
  ✅ Success!

[2/15]
📋 Processing: blueprint.png (ID: 124)
  ⬇️ Downloading file...
  🖼️ Generating image thumbnail...
  📤 Uploading thumbnail: thumbnails/1732045680-blueprint.jpg
  💾 Updating database...
  ✅ Success!

...

════════════════════════════════════════════════════════════

📈 Summary:
  ✅ Successful: 14
  ⏭️ Skipped: 1
  ❌ Failed: 0

🎉 Backfill complete!
```

## Supported File Types

- **PDFs**: `.pdf` files
- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`

Unsupported files (like `.dwg`, `.dxf`) will be skipped.

## Troubleshooting

### Error: "Missing environment variables"

Make sure your `.env` file has both `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.

### Error: "Database query failed"

- Check that your Service Role Key is correct
- Verify you have the `drawings` table in your Supabase database

### Error: "Download failed"

- Verify the file exists in Supabase Storage
- Check your Storage permissions (Service Role Key should have full access)

### Error: "Upload failed"

- Check that the `thumbnails/` folder exists in your `drawings` bucket
- Verify Storage permissions allow uploads

### Thumbnails still not appearing in dashboard

- Clear your browser cache
- Check the browser console for signed URL errors
- Verify the `thumbnail_url` column in database has the correct path

## Running Periodically

You can run this script:

- **Manually**: Whenever you notice drawings without thumbnails
- **Scheduled**: Set up a cron job or scheduled task to run daily/weekly
- **After bulk uploads**: After uploading many files via n8n

## Security Notes

⚠️ **NEVER commit `.env` file to git!**

The `.gitignore` file already excludes `.env`, but double-check:

```bash
git status  # Should NOT show .env file
```

The Service Role Key has admin access - keep it secure!

## Questions?

If thumbnails aren't generating correctly, check:

1. File exists in Supabase Storage
2. File is a supported type (PDF or image)
3. Storage permissions are correct
4. Service Role Key is valid

