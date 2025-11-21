# Final Testing Checklist

Complete this checklist to verify all improvements are working correctly.

## 1. ✅ Delete Modal UX Testing

### Customer Delete
- [ ] Click delete on a customer
- [ ] Verify modal appears with customer name in message
- [ ] Press **Esc** key - modal should close
- [ ] Click outside modal - modal should close
- [ ] Click delete again, press **Tab** - focus should trap within modal
- [ ] Click **Cancel** - modal should close
- [ ] Click **Delete** - button should show spinner and "Deleting..." text
- [ ] Verify buttons are disabled during delete (can't double-click)
- [ ] After successful delete, verify success alert appears
- [ ] Navigate to different tab and back - deleted customer should stay gone

### Project Delete
- [ ] Click delete on a project
- [ ] Verify modal shows project name
- [ ] Test keyboard navigation (Tab, Esc)
- [ ] Verify loading state during deletion
- [ ] Confirm project disappears from list
- [ ] Navigate away and back - confirm still deleted

### Error Handling
- [ ] Disconnect internet, try to delete
- [ ] Modal should stay open with error alert
- [ ] Loading spinner should stop
- [ ] Buttons should re-enable

## 2. ✅ Supabase RLS & Foreign Keys

### Delete Cascades
- [ ] Create a test customer with 2-3 projects
- [ ] Delete the customer
- [ ] Verify all associated projects are also deleted
- [ ] Refresh page - confirm still gone
- [ ] Check Supabase dashboard - verify database rows are gone

### RLS Permissions
- [ ] Log in as **admin** user
  - [ ] Can delete customers
  - [ ] Can delete projects
- [ ] Log in as **engineer** user
  - [ ] Can delete customers
  - [ ] Can delete projects
- [ ] Log in as **viewer** user (if applicable)
  - [ ] Should NOT see delete buttons

### Drawings with Customers/Projects
- [ ] Create a drawing linked to a customer/project
- [ ] Delete the customer
- [ ] Verify drawing still exists but customer_name shows the deleted name
- [ ] (Drawings should NOT cascade delete)

## 3. ✅ Thumbnail Robustness

### Path-Based Thumbnails
- [ ] Find a drawing with thumbnail_url like `"thumbnails/abc123.jpg"`
- [ ] Verify thumbnail displays correctly (should auto-convert to full URL)

### Full URL Thumbnails
- [ ] Find a drawing with thumbnail_url like `"https://..."`
- [ ] Verify thumbnail displays correctly

### Run SQL Patch (if needed)
```sql
-- First check if any bare paths exist
SELECT id, part_number, thumbnail_url
FROM drawings
WHERE thumbnail_url IS NOT NULL
  AND thumbnail_url NOT LIKE 'http%'
LIMIT 10;
```

If results found:
- [ ] Run `sql/normalize-thumbnail-urls.sql` (update with your Supabase URL)
- [ ] Verify all thumbnails now start with `https://`
- [ ] Refresh app and confirm all thumbnails still display

## 4. ✅ n8n/Cloudinary PDF Pipeline

### Upload PDF via n8n Workflow
- [ ] Trigger n8n workflow with a test PDF
- [ ] Check n8n execution log - should complete without errors

### Verify in Supabase
- [ ] Go to Supabase Storage → `drawings/thumbnails/`
- [ ] Find the new thumbnail JPG
- [ ] Right-click → Properties → Verify `Content-Type: image/jpeg`
- [ ] Click thumbnail - should display as image

### Verify in Database
```sql
SELECT id, part_number, thumbnail_url
FROM drawings
ORDER BY created_at DESC
LIMIT 5;
```
- [ ] Newest drawing should have full URL: `https://your-project.supabase.co/storage/v1/object/public/drawings/thumbnails/xxx.jpg`

### Verify in App
- [ ] Go to All Drawings dashboard
- [ ] Find the newly uploaded PDF
- [ ] Thumbnail should display as JPG preview
- [ ] Click "View" - details should show correctly

## 5. ✅ State Refresh & Navigation

### Delete Customer
- [ ] Delete a customer
- [ ] Immediately navigate to "All Drawings" tab
- [ ] Navigate back to "Customers" tab
- [ ] Deleted customer should NOT reappear

### Delete Project
- [ ] Delete a project
- [ ] Switch to "Projects" tab
- [ ] Switch to "Customers" tab
- [ ] Navigate back to "Projects"
- [ ] Deleted project should stay deleted

### Edit Customer/Project
- [ ] Edit a customer name
- [ ] Switch tabs and return
- [ ] Updated name should persist

### Full Page Reload
- [ ] Delete a customer
- [ ] Press **Ctrl+Shift+R** (hard refresh)
- [ ] Deleted customer should still be gone

## 6. ✅ File Organization Verification

### Check File Structure
```bash
# Should see organized structure
ls sql/     # All *.sql files
ls docs/    # All *.md files (except root README)
ls          # Only essential build files
```

### Verify No Broken References
- [ ] Open `package.json` - no references to moved files
- [ ] Open root `README.md` - update any links to moved docs
- [ ] Check build scripts - should still work

### Git Status
```bash
git status
```
- [ ] New folders (`sql/`, `docs/`) should be tracked
- [ ] `.gitignore` should not exclude these folders
- [ ] No unexpected files in git

## 7. ✅ Smoke Tests

### Upload Image via UI
- [ ] Click "Upload Drawing" button
- [ ] Select an image file (PNG/JPG)
- [ ] Fill out form (part number, customer, project)
- [ ] Submit
- [ ] Verify appears in All Drawings
- [ ] Thumbnail should display correctly

### Upload PDF via UI
- [ ] Upload a PDF file
- [ ] Verify it appears in list
- [ ] Check if thumbnail is generated (may take a moment)

### Download Drawing
- [ ] Find any drawing
- [ ] Click download button
- [ ] File should download correctly

### Delete Drawing
- [ ] Find a test drawing
- [ ] Delete it
- [ ] Should disappear from list
- [ ] Refresh page - should stay gone

### Search & Filter
- [ ] Use search bar to find drawings
- [ ] Filter by customer
- [ ] Filter by project
- [ ] All filters should work correctly

### Folder View
- [ ] Switch to folder view
- [ ] Should see customers as folders
- [ ] Expand a customer
- [ ] Should see their drawings
- [ ] No errors in console

### Auto-Create Customers/Projects
**Run SQL first:** `sql/auto-create-customers-projects.sql`

- [ ] Upload a drawing with customer_name: "New Test Customer"
- [ ] Upload a drawing with project_name: "New Test Project"
- [ ] Go to Customers dashboard
- [ ] "New Test Customer" should appear automatically
- [ ] Go to Projects dashboard
- [ ] "New Test Project" should appear automatically

## 8. ✅ Console & Error Logging

### Check Browser Console
- [ ] Open DevTools (F12)
- [ ] Navigate through app
- [ ] Should see no errors (red messages)
- [ ] Delete operations should log clearly

### Network Tab
- [ ] Open Network tab
- [ ] Perform delete operation
- [ ] Should see successful DELETE request
- [ ] No 401/403/500 errors

## Summary Checklist

- [ ] All delete modals working with proper UX
- [ ] RLS policies allow authorized deletes
- [ ] CASCADE deletes work correctly
- [ ] Thumbnails display for both path types
- [ ] n8n PDF pipeline creates proper thumbnails
- [ ] State updates persist across navigation
- [ ] Files properly organized in sql/ and docs/
- [ ] All smoke tests pass
- [ ] No console errors
- [ ] App is production-ready

---

## Issues Found

Document any issues below:

**Issue 1:**
- Description:
- Steps to reproduce:
- Expected:
- Actual:

**Issue 2:**
- Description:
- Steps to reproduce:
- Expected:
- Actual:

---

**Testing Date:** _______________________
**Tester:** _______________________
**Result:** ☐ Pass ☐ Fail ☐ Needs Fixes
