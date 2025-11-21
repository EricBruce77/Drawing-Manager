# Quick Start Guide - ARO Drawing Manager

Follow these steps to get your drawing management system up and running in 15 minutes.

## Step 1: Supabase Setup (5 minutes)

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Name: `aro-drawing-manager`
4. Database Password: Choose a strong password (save it!)
5. Region: Choose closest to you
6. Click **"Create new project"**
7. Wait 2-3 minutes for setup to complete

### 1.2 Run Database Schema
1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open `supabase-schema.sql` from this project
4. Copy ALL the SQL code
5. Paste into Supabase SQL Editor
6. Click **"Run"** (bottom right)
7. You should see "Success. No rows returned" - that's good!

### 1.3 Create Storage Buckets
1. Go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Create bucket `drawings`:
   - Name: `drawings`
   - Public: **NO** (keep private)
   - Click "Create bucket"
4. Click **"New bucket"** again
5. Create bucket `thumbnails`:
   - Name: `thumbnails`
   - Public: **YES**
   - Click "Create bucket"

### 1.4 Set Storage Policies
1. Go back to **SQL Editor**
2. Copy this SQL and run it:

```sql
-- Drawings bucket policies
CREATE POLICY "Authenticated users can view drawings"
ON storage.objects FOR SELECT
USING (bucket_id = 'drawings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Engineers and admins can upload drawings"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'drawings' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('engineer', 'admin'))
);

CREATE POLICY "Engineers and admins can update drawings"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'drawings' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('engineer', 'admin'))
);

CREATE POLICY "Admins can delete drawings"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'drawings' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Thumbnails bucket policies
CREATE POLICY "Anyone can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

CREATE POLICY "Engineers and admins can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'thumbnails' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('engineer', 'admin'))
);
```

### 1.5 Get Your API Keys
1. Go to **Settings** (left sidebar) → **API**
2. Copy these values:
   - **Project URL** (starts with `https://...supabase.co`)
   - **anon public** key (long string)
3. Keep these handy for next step!

## Step 2: Application Setup (5 minutes)

### 2.1 Install Dependencies
```bash
cd C:\Users\ericb\aro-drawing-manager
npm install
```

### 2.2 Configure Environment
1. Create `.env` file in project root
2. Paste this and fill in your values:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_N8N_ANALYZE_DRAWING_WEBHOOK=https://ericbruce.app.n8n.cloud/webhook/analyze-drawing
```

Replace:
- `YOUR-PROJECT.supabase.co` with your Project URL
- `your-anon-key-here` with your anon public key

## Step 3: Create Admin User (2 minutes)

### 3.1 Start the App
```bash
npm run dev
```

Open browser: [http://localhost:5173](http://localhost:5173)

### 3.2 Sign Up
1. Click **"Don't have an account? Sign up"**
2. Enter:
   - Full Name: Your name
   - Email: Your ARO Technologies email
   - Password: Choose a password
3. Click **"Sign Up"**

### 3.3 Make Yourself Admin
1. Go to Supabase Dashboard
2. Click **Table Editor** → **profiles**
3. Find your user (the one you just created)
4. Click the `role` field
5. Change from `viewer` to `admin`
6. Refresh the app in your browser

You're now an admin! 🎉

## Step 4: Upload Your First Drawing (3 minutes)

### 4.1 Create a Customer
1. In the app, click **"Upload Drawing"**
2. In the Customer field, click the **+** button
3. Enter customer name (e.g., "Test Customer")
4. Click **"Add"**

### 4.2 Upload a Drawing
1. Drag and drop a DWG/PDF file (or click to browse)
2. Fill in:
   - Part Number: e.g., `25179-001`
   - Revision: `A`
   - Customer: Select the customer you just created
   - Title: (optional)
3. Click **"Upload 1 Drawing"**

### 4.3 View Your Drawing
1. Go to **"All Drawings"** tab
2. You should see your uploaded drawing!
3. Click on it to view details
4. Click **"Download"** to download it

## Next Steps

### Add Team Members
1. Have team members sign up at your app URL
2. Go to Supabase → Table Editor → profiles
3. Change their role:
   - `engineer` - Can upload and edit
   - `viewer` - Can only view and search

### Organize Drawings
1. Create more customers
2. Create projects under customers
3. Upload drawings and assign to customers/projects

### Search and Filter
1. Use the search bar to find drawings
2. Search by part number, keywords, or descriptions
3. Filter by customer using the dropdown

## Troubleshooting

### "Failed to fetch" error
- Check that `.env` file exists and has correct values
- Make sure Supabase URL and keys are correct
- Restart the dev server (`Ctrl+C`, then `npm run dev`)

### Can't upload files
- Verify storage buckets exist in Supabase
- Check storage policies were created correctly
- Make sure you're logged in as admin or engineer

### "Permission denied" errors
- Check your user role in Supabase profiles table
- Refresh the page after changing roles
- Make sure RLS policies were created properly

## Optional: AI Analysis (Later)

Once you're comfortable with the basics, set up AI analysis:
1. Follow [n8n-workflow-guide.md](n8n-workflow-guide.md)
2. Get Google Gemini API key
3. Create n8n workflow
4. AI will automatically describe your drawings!

## Need Help?

- **Setup Guide**: Check [SETUP.md](SETUP.md) for detailed instructions
- **Full Documentation**: See [README.md](README.md)
- **n8n Workflows**: See [n8n-workflow-guide.md](n8n-workflow-guide.md)

---

**You're all set!** Start uploading your team's mechanical drawings and enjoy organized, searchable drawing management.