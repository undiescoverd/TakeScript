# System Templates Migration Guide

This guide explains how to migrate the hardcoded system templates to the database.

## Prerequisites

- Convex development server must be running (`npx convex dev`)
- You must be authenticated with Convex

## Migration Steps

### Option 1: Using Convex Dashboard (Recommended)

1. Start your Convex dev server:
   ```bash
   npx convex dev
   ```

2. Open the Convex Dashboard (URL shown in terminal)

3. Navigate to **Functions** tab

4. Find and run `migrations:checkMigrationStatus` to check current state:
   - This will show you how many system templates and user templates currently exist

5. Run `migrations:seedSystemTemplates` to populate system templates:
   - Click on the function
   - Click "Run" (no arguments needed)
   - Check the result for success message

6. Verify the migration:
   - Run `migrations:checkMigrationStatus` again
   - You should see 4 system templates now

### Option 2: Using Convex CLI

```bash
# Check current status
npx convex run migrations:checkMigrationStatus

# Run the migration
npx convex run migrations:seedSystemTemplates

# Verify the migration
npx convex run migrations:checkMigrationStatus
```

### Option 3: Programmatic (Node.js)

Create a script `scripts/migrate.ts`:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function migrate() {
  console.log("Checking migration status...");
  const status = await client.mutation(api.migrations.checkMigrationStatus);
  console.log("Current status:", status);

  console.log("\nRunning migration...");
  const result = await client.mutation(api.migrations.seedSystemTemplates);
  console.log("Migration result:", result);

  console.log("\nVerifying migration...");
  const newStatus = await client.mutation(api.migrations.checkMigrationStatus);
  console.log("New status:", newStatus);
}

migrate();
```

Run with: `npx tsx scripts/migrate.ts`

## Migration Result

After successful migration, you'll have 4 system templates:

1. **Tutorial** (Educational category)
   - Step-by-step guide with chapters
   - Icon: BookOpen
   - Color: Blue

2. **Product Demo** (Marketing category)
   - Product demonstration with screen recordings
   - Icon: Video
   - Color: Purple

3. **Training Course** (Training category)
   - Educational content with demonstrations
   - Icon: GraduationCap
   - Color: Green

4. **Product Walkthrough** (Onboarding category)
   - Comprehensive feature overview
   - Icon: MousePointer
   - Color: Orange

## Testing After Migration

1. **Dashboard**: Go to Dashboard > Templates tab
   - You should see 4 system templates
   - Each should have the correct icon and color

2. **New Script Dialog**: Click "New Script"
   - System templates should appear in template picker
   - Fallback hardcoded templates should no longer show

3. **Create from Template**: Select a system template
   - Create a new script
   - Verify content is properly generated with unique IDs

## Troubleshooting

### Migration Already Run
If you see "System templates already exist", the migration was already completed. To re-run:

```bash
# Clear existing system templates
npx convex run migrations:clearSystemTemplates

# Re-run migration
npx convex run migrations:seedSystemTemplates
```

### No Templates Showing
1. Check Convex dev server is running
2. Verify migration succeeded: `npx convex run migrations:checkMigrationStatus`
3. Check browser console for errors
4. Clear browser cache and reload

### Templates Have Wrong Icons
Icons are determined by template name and category. Check:
- Template name matches expected patterns (see `lib/template-icons.ts`)
- Category is set correctly
- Icon mappings in `lib/template-icons.ts`

## Rollback

To remove all system templates:

```bash
npx convex run migrations:clearSystemTemplates
```

This will delete all system templates. The hardcoded fallback will still work in NewScriptDialog.

## Post-Migration Cleanup (Optional)

After successful migration and testing, you can optionally remove the hardcoded templates fallback:

1. Open `components/dashboard/NewScriptDialog.tsx`
2. Remove the `TEMPLATES` array at the top
3. Remove the fallback section in the System Templates area:
   ```typescript
   {/* Fallback to hardcoded templates if no system templates in DB */}
   {filteredSystemTemplates.length === 0 &&
     TEMPLATES.map((template) => (
       // ... template card code
     ))}
   ```

**Note**: Only do this cleanup after verifying the migration works correctly in production!

## Migration Checklist

- [ ] Run migration in development environment
- [ ] Test all 4 system templates work correctly
- [ ] Verify icons and colors display properly
- [ ] Create scripts from each system template
- [ ] Test template search/filter functionality
- [ ] Run migration in staging environment (if applicable)
- [ ] Run migration in production environment
- [ ] Monitor for any issues
- [ ] (Optional) Remove hardcoded fallback code

## Support

If you encounter issues:
1. Check Convex dashboard logs
2. Check browser console for errors
3. Verify Convex schema is up to date
4. Review migration function code in `convex/migrations.ts`
