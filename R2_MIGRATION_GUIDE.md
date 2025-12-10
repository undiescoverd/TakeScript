# R2 Storage Migration Guide

## Status: **IN PROGRESS** ⚠️

Migrating script content storage from Convex to Cloudflare R2 to reduce costs from $25/month to ~$5/month.

## What's Been Completed ✅

1. **AWS SDK Installed** - `@aws-sdk/client-s3` for R2 compatibility
2. **R2 Utility Functions Created** - `lib/r2-storage.ts`
   - `uploadScriptContent()` - Upload script JSON to R2
   - `uploadVersionContent()` - Upload version snapshots to R2
   - `downloadContent()` - Fetch content from R2
   - `deleteContent()` - Remove R2 objects
   - `healthCheck()` - Verify R2 connectivity

3. **Convex Schema Updated** - `convex/schema.ts`
   - Added `contentUrl` field (R2 URL)
   - Added `contentSize` field (bytes)
   - Added `contentHash` field (SHA-256 for caching)
   - Kept old `content` field for backward compatibility

4. **Convex R2 Actions Created** - `convex/r2.ts`
   - `uploadScript` - Convex action wrapper for R2 uploads
   - `uploadVersion` - Version upload wrapper
   - `downloadContent` - Download wrapper
   - `deleteContent` - Delete wrapper
   - `healthCheck` - Health check wrapper

5. **Version Cleanup Added** - `convex/versions.ts`
   - Auto-deletes versions older than 20 per script
   - Saves storage automatically

## What's Remaining 🚧

### Step 1: Set Up Cloudflare R2 (YOU NEED TO DO THIS)

1. **Create R2 Bucket:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
   - Click "Create bucket"
   - Name it: `takescript-content`
   - Region: Automatic
   - Click "Create bucket"

2. **Create API Token:**
   - In R2, click "Manage R2 API Tokens"
   - Click "Create API Token"
   - Permissions: Object Read & Write
   - TTL: Forever
   - Click "Create API Token"
   - **SAVE THESE VALUES:**
     - Account ID: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - Access Key ID: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - Secret Access Key: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

3. **Add to `.env.local`:**
   ```bash
   # Cloudflare R2 Storage
   R2_ACCOUNT_ID=your_account_id_here
   R2_ACCESS_KEY_ID=your_access_key_here
   R2_SECRET_ACCESS_KEY=your_secret_key_here
   R2_BUCKET_NAME=takescript-content
   ```

4. **Restart Convex:**
   ```bash
   # Stop convex dev (Ctrl+C in that terminal)
   npx convex dev
   ```

### Step 2: Update Convex Mutations (CODE - I'LL DO THIS)

- Modify `convex/scripts.ts::update` to:
  1. Upload content to R2 via action
  2. Store R2 URL in database
  3. Keep fallback to `content` field for safety

- Modify `convex/scripts.ts::get` to:
  1. Check if `contentUrl` exists
  2. If yes, download from R2
  3. If no, use `content` field (backward compat)

- Modify `convex/versions.ts::save` to use R2

### Step 3: Migration Script (CODE - I'LL DO THIS)

Create script to move existing content to R2:
- Read all scripts from Convex
- Upload `content` to R2
- Update records with `contentUrl`
- Verify before deleting old `content`

### Step 4: Testing

- Create new script → verify R2 upload
- Edit existing script → verify R2 update
- Load script → verify R2 download
- Create version → verify R2 version storage

## Cost Savings 💰

| Item | Current (Convex Only) | With R2 | Savings |
|------|----------------------|---------|---------|
| Storage (3.27 GB) | $25/month | $5 + $0.05 = $5.05/month | **$19.95/month** |
| Bandwidth | Included | Free (R2 zero egress) | $0 |
| **Total** | **$25/month** | **$5.05/month** | **$19.95/month (80% cheaper)** |

## Architecture

### Before (Current):
```
User → Next.js → Convex → Database (3.27 GB)
                         ↑
                  Everything in Convex
```

### After (With R2):
```
User → Next.js → Convex → Database (metadata only, ~50 MB)
                       ↓
                       R2 Bucket (content, 3.27 GB)
```

### Data Flow:

**Save:**
1. User types in editor
2. Autosave triggers `scripts.update` mutation
3. Mutation calls `r2.uploadScript` action
4. Action uploads JSON to R2
5. Mutation stores R2 URL in database

**Load:**
1. User opens script
2. `scripts.get` query finds record
3. Sees `contentUrl` exists
4. Calls `r2.downloadContent` action
5. Action fetches from R2
6. Returns content to user

## Safety Features

1. **Gradual Migration** - Old `content` field stays until all data is migrated
2. **Backward Compatibility** - Code checks for `contentUrl` before falling back to `content`
3. **Version Limits** - Auto-cleanup prevents runaway growth
4. **Health Checks** - R2 connectivity verification before operations

## Next Steps

1. **YOU**: Set up R2 and add credentials to `.env.local`
2. **ME**: Complete the migration code
3. **WE**: Test thoroughly before deploying
4. **ME**: Run migration script to move existing data
5. **WE**: Monitor for 1 week, then remove old `content` field

## Questions?

Let me know when you've set up R2 and added the credentials. Then I'll complete the migration code!
