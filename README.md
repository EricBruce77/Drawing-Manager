# ARO Technologies Drawing Management System

A professional, team-based drawing management system for organizing, searching, and versioning mechanical engineering drawings (DWG, PDF, DXF, and more).

## Features

### Core Functionality
- **Multi-format Support**: DWG, DXF, PDF, PNG, JPG
- **Drag & Drop Upload**: Easy file uploading with visual feedback
- **Advanced Search**: Search by part number, customer, keywords, or AI-generated descriptions
- **Customer/Project Organization**: Organize drawings by customer and project
- **Version Control**: Track revisions and maintain drawing history
- **Role-Based Access**: Admin, Engineer, and Viewer roles with different permissions
- **Activity Logging**: Complete audit trail of all actions

### AI-Powered Features (Optional)
- **Visual Analysis**: AI describes drawing contents using Google Gemini Vision
- **Auto-Tagging**: Automatically extract searchable keywords
- **Smart Search**: Find drawings by describing what's in them

### Security
- **User Authentication**: Secure login with Supabase Auth
- **Row-Level Security**: Database-level permission enforcement
- **Private Storage**: Files stored securely in Supabase Storage
- **Role-Based Access Control**: Admins, Engineers, and Viewers

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **AI Analysis**: Google Gemini Vision (via n8n)
- **Routing**: React Router v6

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase account ([supabase.com](https://supabase.com))
- n8n account for AI features (optional) ([n8n.io](https://n8n.io))

### Installation

1. **Clone or navigate to the project**:
   ```bash
   cd C:\Users\ericb\aro-drawing-manager
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Supabase**:
   - Create a new Supabase project
   - Run the SQL from `supabase-schema.sql` in the SQL Editor
   - Create storage buckets as described in `SETUP.md`

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_N8N_ANALYZE_DRAWING_WEBHOOK=https://ericbruce.app.n8n.cloud/webhook/analyze-drawing
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Open browser**:
   ```
   http://localhost:5173
   ```

### First-Time Setup

1. **Sign up** with your ARO Technologies email
2. In Supabase Dashboard:
   - Go to **Table Editor** → **profiles**
   - Find your user
   - Change `role` from `viewer` to `admin`
3. Refresh the app - you now have full admin access!

## User Roles

| Role | View Drawings | Upload | Edit | Delete | Manage Users |
|------|---------------|--------|------|--------|--------------|
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Engineer** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |

## Usage Guide

### Uploading Drawings

1. Click **"Upload Drawing"** button or go to Upload tab
2. Drag & drop files or click to select
3. Fill in required fields:
   - **Part Number** (required) - e.g., "25179-001"
   - **Revision** - e.g., "A", "B", "C"
   - **Customer** - Select or create new
   - **Project** - Optional
   - **Title & Description** - Optional
4. Click **"Upload"**

### Searching Drawings

**Quick Search**:
- Type in the search bar
- Searches: part numbers, titles, descriptions, AI-generated content

**Filter by Customer**:
- Use the customer dropdown to filter by specific customer

**Advanced Tips**:
- Search for keywords like "gear", "bracket", "housing"
- Part number searches work with partial matches
- AI descriptions make visual searches possible

### Version Control

When uploading a new revision:
1. Upload the new file
2. Use the same part number
3. Change the revision letter (A → B)
4. The system tracks version history automatically

### Downloading Drawings

1. Click on a drawing card to view details
2. Click **"Download"** button
3. File downloads with original filename
4. Action is logged in activity log

## File Organization

Recommended naming convention for uploads:
```
{part_number}-{revision}.{extension}

Examples:
25179-001-A.dwg
25179-002-B.pdf
BRACKET-MOUNT-A.dxf
```

## AI Analysis Setup (Optional)

For AI-powered drawing analysis:

1. Follow the guide in [n8n-workflow-guide.md](n8n-workflow-guide.md)
2. Set up Google Gemini API key
3. Create n8n workflow
4. Add webhook URL to `.env`

Benefits:
- Automatic description generation
- Searchable keywords extracted
- Find drawings by visual features

## Database Schema

### Main Tables

- **profiles** - User information and roles
- **customers** - Customer organizations
- **projects** - Projects under customers
- **drawings** - Main drawings table
- **tags** - Manual tags for categorization
- **activity_log** - Audit trail

See `supabase-schema.sql` for full schema.

## Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   npm run build
   vercel --prod
   ```

3. **Add environment variables** in Vercel dashboard

### Option 2: Netlify

1. **Install Netlify CLI**:
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   npm run build
   netlify deploy --prod
   ```

### Option 3: Self-Hosted

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Serve the `dist` folder** with any web server:
   - Nginx
   - Apache
   - IIS (Windows)

## Maintenance

### Adding Team Members

1. Admin creates user account (or user self-registers)
2. Admin assigns role in Supabase Dashboard
3. User logs in and starts working

### Backing Up Data

**Database**:
- Supabase automatically backs up your database
- Manual backups: Database → Backups in Supabase

**Files**:
- Files stored in Supabase Storage are backed up
- For extra safety, periodically download all files

### Monitoring

- **Activity Log**: Track all user actions
- **Supabase Dashboard**: Monitor database and storage usage
- **n8n Executions**: Monitor AI analysis workflow

## Troubleshooting

### Can't Upload Files
- Check file size (max 100MB)
- Verify file format is supported
- Check Supabase storage quota

### Search Not Working
- Ensure you have drawings uploaded
- Check that `status` = 'active' on drawings
- Try partial part number search

### AI Analysis Not Running
- Verify n8n webhook URL in `.env`
- Check n8n workflow is active
- Review n8n execution logs

### Permission Denied
- Verify your user role in Supabase
- Check Row Level Security policies
- Contact admin to update your role

## Project Structure

```
aro-drawing-manager/
├── src/
│   ├── components/
│   │   ├── DrawingCard.jsx       # Individual drawing card
│   │   ├── DrawingsGrid.jsx      # Grid view of drawings
│   │   ├── SearchBar.jsx         # Search and filter bar
│   │   ├── Sidebar.jsx           # Navigation sidebar
│   │   └── UploadDrawing.jsx     # Upload interface
│   ├── contexts/
│   │   └── AuthContext.jsx       # Authentication context
│   ├── lib/
│   │   └── supabaseClient.js     # Supabase configuration
│   ├── pages/
│   │   ├── Dashboard.jsx         # Main dashboard
│   │   └── Login.jsx             # Login/signup page
│   ├── App.jsx                   # Main app component
│   ├── index.css                 # Global styles
│   └── main.jsx                  # App entry point
├── supabase-schema.sql           # Database schema
├── n8n-workflow-guide.md         # AI workflow setup
├── SETUP.md                      # Detailed setup guide
└── README.md                     # This file
```

## Future Enhancements

- [ ] Bulk import tool for existing drawings
- [ ] Advanced filtering (by date, file type, tags)
- [ ] Drawing comparison (view changes between revisions)
- [ ] Email notifications for new drawings
- [ ] Mobile app version
- [ ] DWG file preview (convert to PDF/image)
- [ ] Team collaboration features
- [ ] Custom metadata fields

## Support

For questions or issues:

1. Check `SETUP.md` for detailed setup instructions
2. Review `n8n-workflow-guide.md` for AI features
3. Check Supabase logs for errors
4. Contact your system administrator

## License

Internal ARO Technologies tool - Not for redistribution

## Credits

Built with:
- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com)
- [Google Gemini AI](https://ai.google.dev)
- [n8n](https://n8n.io)

---

**ARO Technologies Internal System**
Version 1.0.0