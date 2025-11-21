# Cloudinary Implementation Checklist

Use this checklist to track your progress implementing Cloudinary for PDF thumbnails.

## Phase 1: Cloudinary Setup (15 minutes)

- [ ] **Create Cloudinary account**
  - Go to https://cloudinary.com/users/register/free
  - Sign up and verify email
  - Note: Username = ________________

- [ ] **Get credentials from Dashboard**
  - [ ] Cloud name: ________________
  - [ ] API Key: ________________
  - [ ] API Secret: ________________
  - [ ] Saved to 1Password ✓

- [ ] **Create upload preset**
  - [ ] Name: `pdf-thumbnails`
  - [ ] Signing Mode: Unsigned
  - [ ] Folder: `aro-drawings`
  - [ ] Resource type: Auto
  - [ ] Saved ✓

## Phase 2: n8n Environment Setup (5 minutes)

- [ ] **Add environment variables to n8n**
  ```
  CLOUDINARY_CLOUD_NAME=___________
  CLOUDINARY_API_KEY=___________
  CLOUDINARY_API_SECRET=___________
  ```

- [ ] **Verify existing variables**
  - [ ] SUPABASE_URL exists
  - [ ] SUPABASE_ANON_KEY exists
  - [ ] SUPABASE_SERVICE_KEY exists

## Phase 3: n8n Workflow Updates (30-45 minutes)

### Add Branching Logic

- [ ] **Node 5: IF (Check File Type)**
  - Condition: `{{ $('Insert Drawing Record').item.json[0].file_type.toLowerCase() }} equals 'pdf'`
  - True branch → Cloudinary path
  - False branch → Existing Edge Function

### PDF Path (Cloudinary) - Nodes 6-11

- [ ] **Node 6: Get Signed URL for PDF**
  - Type: HTTP Request
  - Method: POST
  - URL configured ✓
  - Authentication configured ✓

- [ ] **Node 7: Upload PDF to Cloudinary**
  - Type: HTTP Request
  - Method: POST
  - Cloudinary URL configured ✓
  - Form data configured ✓
  - Error handling: Continue on fail ✓

- [ ] **Node 8: Generate Thumbnail URL**
  - Type: Code
  - Transformation URL constructed ✓
  - Format: `w_400,pg_1,f_auto,q_auto`

- [ ] **Node 9: Download Thumbnail**
  - Type: HTTP Request
  - Method: GET
  - Response format: File ✓

- [ ] **Node 10: Upload Thumbnail to Supabase**
  - Type: HTTP Request
  - Method: POST
  - Path: `thumbnails/{id}.jpg` ✓
  - Content-Type: `image/jpeg` ✓

- [ ] **Node 11: Update Database**
  - Type: HTTP Request
  - Method: PATCH
  - Updates `thumbnail_url` field ✓

### Image Path (Keep Existing)

- [ ] **Existing Edge Function node still connected**
  - Should be triggered when file_type ≠ 'pdf'
  - No changes needed ✓

## Phase 4: Error Handling (10 minutes)

- [ ] **Configure retry settings on all Cloudinary nodes (6-11)**
  - On Error: Continue
  - Retry on Fail: Yes
  - Max Retries: 2
  - Retry Interval: 5000ms

- [ ] **Add error logging node (optional)**
  - Logs to `activity_log` table
  - Records failed thumbnail generations

## Phase 5: Testing (20 minutes)

### Test 1: PDF Upload
- [ ] Upload a PDF to Google Drive folder
- [ ] Watch n8n execution:
  - [ ] File downloads from Google Drive ✓
  - [ ] Uploads to Supabase Storage ✓
  - [ ] Drawing record created ✓
  - [ ] IF node detects PDF (goes to Cloudinary path) ✓
  - [ ] PDF uploads to Cloudinary ✓
  - [ ] Thumbnail URL generated ✓
  - [ ] Thumbnail downloaded ✓
  - [ ] Thumbnail uploaded to Supabase ✓
  - [ ] Database updated ✓
- [ ] Check Supabase Storage:
  - [ ] Original PDF in `drawings/` ✓
  - [ ] Thumbnail in `thumbnails/` ✓
- [ ] Reload dashboard:
  - [ ] PDF thumbnail appears ✓
  - [ ] Click "View" - PDF opens ✓

### Test 2: Image Upload (Regression)
- [ ] Upload a JPG to Google Drive folder
- [ ] Watch n8n execution:
  - [ ] File downloads ✓
  - [ ] Uploads to Supabase ✓
  - [ ] Drawing record created ✓
  - [ ] IF node detects non-PDF (goes to Edge Function) ✓
  - [ ] Edge Function generates thumbnail ✓
- [ ] Reload dashboard:
  - [ ] JPG thumbnail appears ✓
  - [ ] No regression - images still work ✓

### Test 3: Error Handling
- [ ] Upload a corrupted PDF
- [ ] Verify:
  - [ ] Workflow continues (doesn't fail) ✓
  - [ ] Drawing appears in dashboard (no thumbnail) ✓
  - [ ] Error logged (if error logging implemented) ✓

## Phase 6: Monitoring Setup (10 minutes)

- [ ] **Cloudinary Dashboard**
  - [ ] Bookmark: https://console.cloudinary.com
  - [ ] Check transformation usage
  - [ ] Set up usage alerts (optional)

- [ ] **Supabase Dashboard**
  - [ ] Check thumbnail storage size
  - [ ] Review Edge Function logs
  - [ ] Monitor database performance

- [ ] **n8n Dashboard**
  - [ ] Check execution history
  - [ ] Monitor error rate
  - [ ] Review execution times

## Phase 7: Documentation (5 minutes)

- [ ] **Update team wiki/docs**
  - [ ] Cloudinary credentials location
  - [ ] Workflow diagram
  - [ ] Troubleshooting guide

- [ ] **Create backup**
  - [ ] Export n8n workflow JSON
  - [ ] Save to repository
  - [ ] Tag version (e.g., `v2.0-cloudinary`)

## Phase 8: Optimization (Optional)

- [ ] **Implement retry workflow**
  - [ ] Create scheduled workflow (nightly)
  - [ ] Query PDFs without thumbnails
  - [ ] Retry Cloudinary pipeline

- [ ] **Tune transformation settings**
  - [ ] Test different quality settings (q_auto vs q_90)
  - [ ] Test different sizes (w_400 vs w_600)
  - [ ] Compare file sizes and visual quality

- [ ] **Add monitoring alerts**
  - [ ] Set up email notifications for failures
  - [ ] Create dashboard for metrics
  - [ ] Log to external service (Datadog, New Relic, etc.)

## Success Criteria

After completing this checklist, you should have:

✅ **Working PDF thumbnails** - PDFs uploaded via Google Drive show thumbnails on dashboard
✅ **Working image thumbnails** - JPG/PNG files still work as before
✅ **Graceful error handling** - Failed thumbnails don't break the workflow
✅ **Monitored usage** - Can track Cloudinary and Supabase usage
✅ **Documented process** - Team knows how the system works
✅ **Cost-effective** - Within free tier limits ($0/month)

## Timeline Estimate

- **Phase 1-2:** 20 minutes (setup accounts and env vars)
- **Phase 3:** 45 minutes (build n8n workflow)
- **Phase 4:** 10 minutes (error handling)
- **Phase 5:** 20 minutes (testing)
- **Phase 6-7:** 15 minutes (monitoring and docs)

**Total:** ~2 hours

## Troubleshooting

If you encounter issues:

1. **Check the logs**
   - n8n execution history
   - Cloudinary dashboard → Activity
   - Supabase Edge Function logs

2. **Review the guides**
   - [CLOUDINARY_PDF_THUMBNAILS.md](./CLOUDINARY_PDF_THUMBNAILS.md) - Full implementation guide
   - [n8n-workflow-diagram.md](./n8n-workflow-diagram.md) - Visual workflow
   - [THUMBNAIL_DEPLOYMENT.md](./THUMBNAIL_DEPLOYMENT.md) - Original Edge Function guide

3. **Test incrementally**
   - Test each node individually
   - Use n8n's "Execute Node" feature
   - Check intermediate outputs

4. **Ask for help**
   - Cloudinary support: https://support.cloudinary.com
   - Supabase Discord: https://discord.supabase.com
   - n8n Community: https://community.n8n.io

---

**Ready to start?** Begin with Phase 1 and check off items as you go! 🚀

**Last Updated:** 2025-11-20
**Version:** 1.0
