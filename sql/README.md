# SQL Scripts

This directory contains SQL migration scripts and database utilities for the ARO Drawing Manager.

## Active/Required Scripts

Run these in order for initial setup:

1. **supabase-schema.sql** - Main database schema
2. **fix-delete-policies.sql** - Row Level Security policies for deletes
3. **fix-cascade-delete.sql** - CASCADE delete constraints
4. **auto-create-customers-projects.sql** - Auto-create customers/projects from drawings
5. **enable-realtime.sql** - Enable real-time subscriptions

## Feature-Specific Scripts

- **patch-thumbnail-urls.sql** - Update drawing thumbnail URLs to Cloudinary
- **add-update-tracking.sql** - Add update request tracking fields
- **add-completion-tracking.sql** - Track drawing completion status
- **add-drawing-source-field.sql** - Track drawing source (upload/drive)

## Diagnostic/Utility Scripts

- **diagnose-delete-issues.sql** - Debug delete problems
- **check-foreign-keys.sql** - List all foreign key constraints
- **verify-database.sql** - Verify database structure

## Search Improvements

- **fix-search-function.sql** - Improve search functionality
- **update-search-include-customer.sql** - Include customers in search
- **update-search-include-project.sql** - Include projects in search
- **fix-search-with-project.sql** - Fix project search

## Other

- **fix-storage-permissions.sql** - Supabase Storage permissions
- **fix-activity-log-fk.sql** - Activity log foreign keys
- **fix-completion-log-trigger.sql** - Completion tracking trigger

---

**Note:** Once applied, most migration scripts can be archived or deleted from production.
