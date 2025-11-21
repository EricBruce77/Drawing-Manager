# User Access Control Setup Guide

This guide will help you implement email-based access control so only approved company users can sign up and access the system.

## Overview

The user access control system provides:
- **Email Whitelist**: Only pre-approved email addresses can sign up
- **Admin Management Panel**: Admins can add/remove users and toggle their access
- **Domain-Based Access** (Optional): Allow entire company domains (e.g., @arotechnologies.com)
- **Status Tracking**: See which allowed users have registered vs. not yet registered

## Setup Steps

### Step 1: Run the SQL Script

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Open the file: `sql/create-user-access-control.sql`
4. **IMPORTANT**: Before running, update line 71 with your actual admin email:

```sql
INSERT INTO allowed_users (email, notes, allowed_by)
VALUES
  ('YOUR_ACTUAL_EMAIL@company.com', 'Initial admin user', NULL),
  ('admin@company.com', 'Admin user', NULL)
ON CONFLICT (email) DO NOTHING;
```

Replace `'YOUR_ACTUAL_EMAIL@company.com'` with the email address you use to log in as admin.

5. Click **Run** to execute the script

### Step 2: Verify Database Setup

Run this query in Supabase SQL Editor to verify the setup:

```sql
-- Check that tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('allowed_users', 'allowed_domains');

-- Check that your email was added
SELECT * FROM allowed_users;

-- Test the validation function
SELECT is_email_allowed('YOUR_ACTUAL_EMAIL@company.com');
-- Should return: true
```

### Step 3: Update Frontend (Already Done)

The following frontend changes have already been implemented:

✅ [Dashboard.jsx](../src/pages/Dashboard.jsx) - Routes to UserManagement component
✅ [Sidebar.jsx](../src/components/Sidebar.jsx) - Shows "User Access" menu item for admins
✅ [UserManagement.jsx](../src/components/UserManagement.jsx) - Admin panel to manage users
✅ [AuthContext.jsx](../src/contexts/AuthContext.jsx) - Validates emails during signup

### Step 4: Test the System

#### Test 1: Admin Access to User Management
1. Log in as an admin user
2. Click **"User Access"** in the sidebar
3. You should see:
   - Stats dashboard (Total Allowed, Registered, Active)
   - Table of allowed users
   - "Add User" button

#### Test 2: Add a New User
1. In the User Management panel, click **"Add User"**
2. Enter a test email (e.g., `testuser@company.com`)
3. Add optional notes (e.g., "Engineering team")
4. Click **"Add User"**
5. Verify the user appears in the table with status "Not Registered"

#### Test 3: Successful Signup (Allowed Email)
1. Sign out of your admin account
2. Go to the login page
3. Click **"Sign up"**
4. Use the email you just added (`testuser@company.com`)
5. Fill out the form and submit
6. **Expected**: Account created successfully!
7. Log back in as admin and check User Access panel
8. The user's status should now show **"Registered"**

#### Test 4: Blocked Signup (Unauthorized Email)
1. Sign out
2. Go to signup page
3. Try to sign up with an email NOT in the whitelist (e.g., `unauthorized@example.com`)
4. **Expected**: Error message: *"This email is not authorized to access the system. Please contact your administrator to request access."*

#### Test 5: Toggle User Active/Inactive
1. Log in as admin
2. Go to User Access panel
3. Click the **"Active"** button next to a user
4. It should change to **"Inactive"**
5. Sign out and try to sign up with that email
6. **Expected**: Signup should be blocked
7. Toggle back to **"Active"** and try again
8. **Expected**: Signup should work

#### Test 6: Remove User
1. As admin, go to User Access panel
2. Click **"Remove"** on a test user
3. Confirm the deletion
4. User should disappear from the table
5. Try to sign up with that email
6. **Expected**: Signup blocked

## Optional: Domain-Based Access

If you want to allow all emails from your company domain (e.g., @arotechnologies.com), you can use the `allowed_domains` table:

```sql
INSERT INTO allowed_domains (domain)
VALUES ('arotechnologies.com');
```

Now any email ending in `@arotechnologies.com` will be allowed to sign up, even if not explicitly added to the whitelist.

**Note**: Individual emails in the whitelist will still be checked for `is_active = true`.

## How It Works

### Signup Flow

```
User enters email/password
         ↓
AuthContext.signUp() called
         ↓
Calls is_email_allowed(email)
         ↓
    ┌────────┐
    │ Checks │
    └────────┘
         ↓
   ┌─────────────────┐
   │ Email in        │ YES → Allow signup
   │ allowed_users   │──────→ Continue to Supabase Auth
   │ & is_active?    │
   └─────────────────┘
         │ NO
         ↓
   ┌─────────────────┐
   │ Email domain in │ YES → Allow signup
   │ allowed_domains?│──────→ Continue to Supabase Auth
   └─────────────────┘
         │ NO
         ↓
   Block signup with error message
```

### Database Structure

**allowed_users table:**
- `email` - The email address to whitelist
- `is_active` - Toggle access on/off without deleting
- `notes` - Admin notes (e.g., "Sales team", "Contractor")
- `added_at` - When the email was added
- `allowed_by` - Which admin added them

**allowed_domains table (optional):**
- `domain` - Company domain (e.g., "company.com")

**user_access_summary view:**
- Joins `allowed_users` with `auth.users` and `profiles`
- Shows whether each allowed email has registered yet
- Displays who added each user

## Security Features

✅ **Row Level Security (RLS)**: Only admins can view/manage the whitelist
✅ **Email Validation**: Checked before Supabase auth.signUp() is called
✅ **Case-Insensitive**: Emails are normalized to lowercase
✅ **Prevent Double-Signup**: Unique constraint on email column
✅ **Soft Delete**: Use `is_active = false` instead of deleting records

## Troubleshooting

### Error: "Unable to verify email permission"
- Check that the `is_email_allowed()` function was created successfully
- Verify RLS policies allow the function to read `allowed_users` table

### Admin Can't See User Access Panel
- Verify your user has `role = 'admin'` in the `profiles` table:
  ```sql
  SELECT id, email, full_name, role FROM profiles WHERE id = auth.uid();
  ```
- Update if needed:
  ```sql
  UPDATE profiles SET role = 'admin' WHERE email = 'your-email@company.com';
  ```

### User Can Sign Up But Shouldn't
- Check if their domain is in `allowed_domains`:
  ```sql
  SELECT * FROM allowed_domains;
  ```
- If not wanted, remove it:
  ```sql
  DELETE FROM allowed_domains WHERE domain = 'unwanted-domain.com';
  ```

### Can't Add Users in User Management Panel
- Check browser console for errors
- Verify your current user is admin
- Test the INSERT directly in SQL Editor:
  ```sql
  INSERT INTO allowed_users (email, notes, allowed_by)
  VALUES ('test@company.com', 'Test user', auth.uid());
  ```

## Next Steps

1. ✅ Run the SQL script with your admin email
2. ✅ Test all scenarios above
3. ✅ Add your team members' emails via the User Management panel
4. ✅ (Optional) Add your company domain for automatic approval
5. ✅ Share the signup link with your team

## Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check Supabase logs for database errors
3. Verify RLS policies are active: `SHOW row_security` in SQL Editor
4. Test the `is_email_allowed()` function directly in SQL Editor

---

**Last Updated**: November 21, 2025
**Related Files**:
- [create-user-access-control.sql](../sql/create-user-access-control.sql)
- [UserManagement.jsx](../src/components/UserManagement.jsx)
- [AuthContext.jsx](../src/contexts/AuthContext.jsx)
- [Sidebar.jsx](../src/components/Sidebar.jsx)
- [Dashboard.jsx](../src/pages/Dashboard.jsx)
