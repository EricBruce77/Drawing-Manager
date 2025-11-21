# SQL Setup Order

Run these SQL scripts in order for proper setup.

## ✅ Already Applied (based on fixes during session)

These were run to fix delete issues and folder view:

1. ✅ **fix-delete-policies.sql** - RLS DELETE policies
2. ✅ **fix-cascade-delete.sql** - CASCADE constraints for customer→projects
3. ✅ **change-customer-project-to-text.sql** - Changed customer_id/project_id to TEXT

## ⏳ Ready to Run When Needed

### 🔐 Security: User Access Control (Email Whitelist)

**When to run:** Before going live to restrict access to company users only

```bash
# Run in Supabase SQL Editor
sql/create-user-access-control.sql
```

**⚠️ IMPORTANT**: Before running, edit the SQL file and replace `'your-admin-email@company.com'` on line 71 with your actual admin email address!

**What it does:**
- Creates `allowed_users` table for email whitelist
- Creates `allowed_domains` table for domain-based access (optional)
- Creates `is_email_allowed()` function to validate signups
- Creates `user_access_summary` view for admin panel
- Adds RLS policies so only admins can manage the whitelist
- Frontend automatically validates emails during signup

**Test:**
- Log in as admin and go to "User Access" in sidebar
- Add a test email to whitelist
- Sign out and try to sign up with that email - should work
- Try to sign up with unauthorized email - should be blocked
- See full testing guide: [docs/USER_ACCESS_SETUP.md](../docs/USER_ACCESS_SETUP.md)

### Core Feature: Auto-Create Customers/Projects

**When to run:** Before using n8n workflow or when you want automatic customer/project creation

```bash
# Run in Supabase SQL Editor
sql/auto-create-customers-projects.sql
```

**What it does:**
- Creates database trigger on `drawings` table
- When a drawing is inserted with a new `customer_name`, creates customer automatically
- When a drawing is inserted with a new `project_name`, creates project automatically
- Links projects to customers when both are provided

**Test:**
- Upload a drawing with customer_name: "Test Customer ABC"
- Check Customers dashboard - should auto-appear
- Upload a drawing with project_name: "Test Project XYZ"
- Check Projects dashboard - should auto-appear

### Optional: Normalize Existing Thumbnail URLs

**When to run:** If you have existing drawings with bare storage paths (not full URLs)

**First, check if needed:**
```sql
SELECT id, part_number, thumbnail_url
FROM drawings
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url NOT LIKE 'http%'
LIMIT 10;
```

**If results found, run:**
```bash
# Edit file first - replace 'https://your-project.supabase.co' with your actual URL
sql/normalize-thumbnail-urls.sql
```

**What it does:**
- Converts paths like `"thumbnails/abc123.jpg"`
- To full URLs like `"https://your-project.supabase.co/storage/v1/object/public/drawings/thumbnails/abc123.jpg"`

## 📋 Full Schema Setup (Fresh Install)

If setting up from scratch, run in this order:

1. **supabase-schema.sql** - Main database schema
2. **enable-realtime.sql** - Enable real-time subscriptions
3. **fix-storage-permissions.sql** - Supabase Storage RLS
4. **fix-delete-policies.sql** - DELETE policies
5. **fix-cascade-delete.sql** - CASCADE constraints
6. **create-user-access-control.sql** - Email whitelist security (⚠️ edit admin email first!)
7. **auto-create-customers-projects.sql** - Auto-create trigger
8. **add-update-tracking.sql** - Update request tracking
9. **add-completion-tracking.sql** - Completion status tracking
10. **fix-activity-log-fk.sql** - Activity log foreign keys

## 🔍 Diagnostic Scripts (Use When Debugging)

- **diagnose-delete-issues.sql** - Check RLS policies and FK constraints
- **check-foreign-keys.sql** - List all foreign keys
- **verify-database.sql** - Verify database structure

## 🔎 Search Improvements (Optional)

- **fix-search-function.sql** - Improve search
- **update-search-include-customer.sql** - Include customers in search
- **update-search-include-project.sql** - Include projects in search
- **fix-search-with-project.sql** - Fix project search

## 📦 Feature Additions (As Needed)

- **add-drawing-source-field.sql** - Track source (upload/drive)
- **patch-thumbnail-urls.sql** - Cloudinary URL patches
- **fix-completion-log-trigger.sql** - Completion tracking trigger

---

**Note:** Most migration scripts are idempotent (safe to run multiple times) but always backup your database before running SQL migrations.

## Quick Command Reference

```bash
# Check Supabase connection
supabase status

# Run SQL file
cat sql/auto-create-customers-projects.sql | supabase db execute

# Or use Supabase dashboard:
# 1. Go to SQL Editor
# 2. Paste SQL content
# 3. Click "Run"
```
