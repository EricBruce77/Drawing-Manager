# ARO Technologies Drawing Manager - Setup Guide

## 1. Supabase Database Setup

### Step 1: Create a New Supabase Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project: **"aro-drawing-manager"**
3. Save your project URL and anon key

### Step 2: Run Database Schema
1. In Supabase Dashboard, go to **SQL Editor**
2. Create a new query
3. Copy and paste the entire contents of `supabase-schema.sql`
4. Click **Run** to execute the schema

This will create:
- User profiles with role-based access (admin, engineer, viewer)
- Customers and Projects tables
- Drawings table with version control
- Tags and categorization
- Activity logging for audit trail
- Search functionality

### Step 3: Set Up Storage Buckets

In Supabase Dashboard, go to **Storage**:

#### Create "drawings" bucket:
1. Click **New bucket**
2. Name: `drawings`
3. **Public bucket**: ❌ NO (keep private)
4. **File size limit**: 100 MB
5. **Allowed MIME types**:
   - `application/dwg`
   - `application/acad`
   - `application/x-dwg`
   - `application/pdf`
   - `image/png`
   - `image/jpeg`
   - `application/dxf`
   - `application/x-dxf`

#### Create "thumbnails" bucket:
1. Click **New bucket**
2. Name: `thumbnails`
3. **Public bucket**: ✅ YES (for preview images)
4. **File size limit**: 5 MB
5. **Allowed MIME types**:
   - `image/png`
   - `image/jpeg`
   - `image/webp`

### Step 4: Configure Storage Policies

Run this SQL in the SQL Editor to set up storage access policies:

```sql
-- Drawings bucket policies
CREATE POLICY "Authenticated users can view drawings"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'drawings' AND
    auth.uid() IS NOT NULL
);

CREATE POLICY "Engineers and admins can upload drawings"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'drawings' AND
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
);

CREATE POLICY "Engineers and admins can update drawings"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'drawings' AND
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
);

CREATE POLICY "Admins can delete drawings"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'drawings' AND
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Thumbnails bucket policies (public read)
CREATE POLICY "Anyone can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

CREATE POLICY "Engineers and admins can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'thumbnails' AND
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
);
```

### Step 5: Configure Email Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)
4. Disable **"Confirm email"** if you want instant access (or keep enabled for security)

## 2. Application Setup

### Step 1: Install Dependencies
```bash
cd C:\Users\ericb\aro-drawing-manager
npm install
```

### Step 2: Configure Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_N8N_ANALYZE_DRAWING_WEBHOOK=https://ericbruce.app.n8n.cloud/webhook/analyze-drawing
   ```

### Step 3: Create First Admin User
1. Start the app: `npm run dev`
2. Sign up with your ARO Technologies email
3. In Supabase Dashboard, go to **Table Editor** → **profiles**
4. Find your user and change `role` from `viewer` to `admin`

## 3. n8n Workflow Setup (Optional - AI Analysis)

This workflow analyzes uploaded drawings and generates searchable descriptions.

### Create Workflow in n8n:

1. **Webhook Trigger**
   - URL: `/webhook/analyze-drawing`
   - Method: POST
   - Expected data: `{ drawing_id, file_url }`

2. **Supabase - Get Drawing Details**
   - Fetch drawing metadata from `drawings` table

3. **HTTP Request - Download Drawing**
   - Download file from Supabase Storage URL
   - Convert to base64 if image format

4. **Google Gemini Vision Analysis** (if image/PDF)
   - Prompt: "Analyze this mechanical engineering drawing. Describe: 1) Main components visible, 2) Type of part (gear, bracket, assembly, etc.), 3) Key features (holes, threads, dimensions visible), 4) Any part numbers or identifiers visible. Be concise but thorough."
   - Extract AI description

5. **Code Node - Extract Tags**
   ```javascript
   const description = $input.item.json.description;
   const tags = [];

   // Extract common engineering terms
   const keywords = ['gear', 'bracket', 'assembly', 'shaft', 'bearing', 'plate', 'mount', 'housing'];
   keywords.forEach(keyword => {
       if (description.toLowerCase().includes(keyword)) {
           tags.push(keyword);
       }
   });

   return { tags };
   ```

6. **Supabase - Update Drawing**
   - Update `drawings` table:
     - `ai_description` = AI analysis
     - `ai_tags` = extracted tags
     - `analyzed_at` = NOW()

## 4. User Management

### Adding Team Members

**Option 1: Self-Registration**
1. Share the app URL with team members
2. They sign up with ARO Technologies email
3. You (admin) assign their role in Supabase

**Option 2: Manual Creation**
1. In Supabase Dashboard: **Authentication** → **Users**
2. Click **Add user**
3. Enter email and temporary password
4. Set role in **profiles** table

### User Roles

- **Admin**: Full access - manage users, upload, edit, delete drawings
- **Engineer**: Upload, edit, search drawings
- **Viewer**: View and search drawings only

## 5. Importing Existing Drawings

### Bulk Upload Process

1. **Organize files by customer** (matches your current structure)
2. **Upload via the app** (drag-and-drop interface)
3. **System will**:
   - Extract part number from filename (e.g., `25179-001.dwg` → part `25179-001`)
   - Store in Supabase Storage
   - Create database entry
   - Optionally trigger AI analysis

### Batch Import Script (Optional)

For importing 1000+ drawings, I can create a Node.js script that:
- Scans your local folders
- Uploads to Supabase Storage
- Creates database entries automatically
- Preserves folder structure (Customer → Project)

Let me know if you need this!

## 6. Running the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

## 7. Deployment (Future)

Options for hosting:
- **Vercel** (recommended - free tier available)
- **Netlify**
- **ARO Technologies server** (self-hosted)

## Next Steps

1. ✅ Run database schema in Supabase
2. ✅ Create storage buckets
3. ✅ Configure environment variables
4. ✅ Create admin user
5. ⬜ Test upload functionality
6. ⬜ Configure n8n workflow (optional)
7. ⬜ Add team members
8. ⬜ Import existing drawings

## Support

For issues or questions, contact the system administrator.