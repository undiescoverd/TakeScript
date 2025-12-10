/**
 * R2 Migration Functions
 *
 * Migrates script and version content from Convex to Cloudflare R2.
 * Run via: npx convex run migration:migrateAllScripts
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Return types for migration actions
type MigrateResult = {
  success: boolean;
  url?: string;
  size?: number;
  error?: string;
};

type MigrateAllResult = {
  success: boolean;
  message: string;
  migrated: number;
  failed: number;
  errors?: Array<{ scriptId: string; title: string; error: string }>;
};

type ClearResult = {
  success: boolean;
  message: string;
  cleared: number;
  failed: number;
};

type MigrationStatusResult = {
  needsMigration: number;
  migratedButNotCleared: number;
  convexStorageUsed: number;
  potentialSavings: number;
  scripts: {
    toMigrate: Array<{ id: string; title: string; size: number }>;
    migrated: Array<{ id: string; title: string; size: number }>;
  };
};

// Get all scripts that need migration (have content but no contentUrl)
export const getScriptsToMigrate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const scripts = await ctx.db.query("scripts").collect();

    // Filter scripts that have content but no R2 URL yet
    return scripts
      .filter(script => script.content && script.content.length > 0 && !script.contentUrl)
      .map(script => ({
        _id: script._id,
        title: script.title,
        contentLength: script.content.length,
      }));
  },
});

// Get a single script's content for migration
export const getScriptContent = internalQuery({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);
    if (!script) return null;
    return {
      _id: script._id,
      content: script.content,
    };
  },
});

// Update script with R2 URL after migration
export const updateScriptWithR2 = internalMutation({
  args: {
    scriptId: v.id("scripts"),
    contentUrl: v.string(),
    contentSize: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scriptId, {
      contentUrl: args.contentUrl,
      contentSize: args.contentSize,
      // Keep content field for now as backup
    });
  },
});

// Clear content field after successful migration (run separately after verification)
export const clearMigratedContent = internalMutation({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const script = await ctx.db.get(args.scriptId);
    if (!script || !script.contentUrl) {
      throw new Error("Script not migrated yet");
    }

    await ctx.db.patch(args.scriptId, {
      content: "", // Clear the content field to save space
    });
  },
});

// Migrate a single script to R2
export const migrateScript = action({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args): Promise<MigrateResult> => {
    // Get script content
    const script = await ctx.runQuery(internal.migration.getScriptContent, {
      scriptId: args.scriptId,
    });

    if (!script || !script.content) {
      return { success: false, error: "Script not found or empty" };
    }

    // Upload to R2
    const r2Result = await ctx.runAction(api.r2.uploadScript, {
      scriptId: args.scriptId,
      content: script.content,
    });

    if (!r2Result.success) {
      return { success: false, error: r2Result.error };
    }

    // Update database with R2 URL
    await ctx.runMutation(internal.migration.updateScriptWithR2, {
      scriptId: args.scriptId,
      contentUrl: r2Result.url!,
      contentSize: r2Result.size!,
    });

    return {
      success: true,
      url: r2Result.url,
      size: r2Result.size,
    };
  },
});

// Migrate all scripts to R2 (main migration function)
export const migrateAllScripts = action({
  args: {},
  handler: async (ctx): Promise<MigrateAllResult> => {
    console.log("Starting R2 migration...");

    // Get all scripts needing migration
    const scripts = await ctx.runQuery(internal.migration.getScriptsToMigrate, {});
    console.log(`Found ${scripts.length} scripts to migrate`);

    if (scripts.length === 0) {
      return {
        success: true,
        message: "No scripts need migration",
        migrated: 0,
        failed: 0,
      };
    }

    let migrated = 0;
    let failed = 0;
    const errors: Array<{ scriptId: string; title: string; error: string }> = [];

    // Migrate each script
    for (const script of scripts) {
      try {
        console.log(`Migrating: ${script.title} (${script.contentLength} bytes)`);

        const result = await ctx.runAction(api.migration.migrateScript, {
          scriptId: script._id,
        });

        if (result.success) {
          console.log(`  ✓ Migrated to R2 (${result.size} bytes)`);
          migrated++;
        } else {
          console.log(`  ✗ Failed: ${result.error}`);
          failed++;
          errors.push({
            scriptId: script._id,
            title: script.title,
            error: result.error || "Unknown error",
          });
        }
      } catch (error: any) {
        console.log(`  ✗ Error: ${error.message}`);
        failed++;
        errors.push({
          scriptId: script._id,
          title: script.title,
          error: error.message,
        });
      }
    }

    console.log(`\nMigration complete: ${migrated} migrated, ${failed} failed`);

    return {
      success: failed === 0,
      message: `Migration complete: ${migrated} migrated, ${failed} failed`,
      migrated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
});

// Clear all migrated content (run after verifying migration worked)
export const clearAllMigratedContent = action({
  args: {},
  handler: async (ctx): Promise<ClearResult> => {
    console.log("Clearing migrated content from Convex...");

    // Get all scripts that have been migrated (have contentUrl)
    const scripts = await ctx.runQuery(internal.migration.getMigratedScripts, {});
    console.log(`Found ${scripts.length} migrated scripts to clear`);

    let cleared = 0;
    let failed = 0;

    for (const script of scripts) {
      try {
        await ctx.runMutation(internal.migration.clearMigratedContent, {
          scriptId: script._id,
        });
        cleared++;
        console.log(`  ✓ Cleared: ${script.title}`);
      } catch (error: any) {
        failed++;
        console.log(`  ✗ Failed to clear ${script.title}: ${error.message}`);
      }
    }

    return {
      success: failed === 0,
      message: `Cleared ${cleared} scripts, ${failed} failed`,
      cleared,
      failed,
    };
  },
});

// Get scripts that have been migrated
export const getMigratedScripts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const scripts = await ctx.db.query("scripts").collect();

    return scripts
      .filter(script => script.contentUrl && script.content && script.content.length > 0)
      .map(script => ({
        _id: script._id,
        title: script.title,
        contentLength: script.content.length,
        contentUrl: script.contentUrl,
      }));
  },
});

// Get migration status
export const getMigrationStatus = action({
  args: {},
  handler: async (ctx): Promise<MigrationStatusResult> => {
    const toMigrate = await ctx.runQuery(internal.migration.getScriptsToMigrate, {});
    const migrated = await ctx.runQuery(internal.migration.getMigratedScripts, {});

    // Calculate sizes
    const convexSize = toMigrate.reduce((sum, s) => sum + s.contentLength, 0);
    const migratedButNotCleared = migrated.reduce((sum, s) => sum + s.contentLength, 0);

    return {
      needsMigration: toMigrate.length,
      migratedButNotCleared: migrated.length,
      convexStorageUsed: convexSize + migratedButNotCleared,
      potentialSavings: migratedButNotCleared,
      scripts: {
        toMigrate: toMigrate.map(s => ({ id: s._id, title: s.title, size: s.contentLength })),
        migrated: migrated.map(s => ({ id: s._id, title: s.title, size: s.contentLength })),
      },
    };
  },
});

// Versions migration
export const getVersionsToMigrate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const versions = await ctx.db.query("scriptVersions").collect();

    return versions
      .filter(v => v.content && v.content.length > 0 && !v.contentUrl)
      .map(v => ({
        _id: v._id,
        scriptId: v.scriptId,
        versionNumber: v.versionNumber,
        contentLength: v.content.length,
      }));
  },
});

export const getVersionContent = internalQuery({
  args: { versionId: v.id("scriptVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) return null;
    return {
      _id: version._id,
      scriptId: version.scriptId,
      versionNumber: version.versionNumber,
      content: version.content,
    };
  },
});

export const updateVersionWithR2 = internalMutation({
  args: {
    versionId: v.id("scriptVersions"),
    contentUrl: v.string(),
    contentSize: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.versionId, {
      contentUrl: args.contentUrl,
      contentSize: args.contentSize,
    });
  },
});

export const migrateVersion = action({
  args: { versionId: v.id("scriptVersions") },
  handler: async (ctx, args): Promise<MigrateResult> => {
    const version = await ctx.runQuery(internal.migration.getVersionContent, {
      versionId: args.versionId,
    });

    if (!version || !version.content) {
      return { success: false, error: "Version not found or empty" };
    }

    const r2Result = await ctx.runAction(api.r2.uploadVersion, {
      scriptId: version.scriptId,
      versionNumber: version.versionNumber,
      content: version.content,
    });

    if (!r2Result.success) {
      return { success: false, error: r2Result.error };
    }

    await ctx.runMutation(internal.migration.updateVersionWithR2, {
      versionId: args.versionId,
      contentUrl: r2Result.url!,
      contentSize: r2Result.size!,
    });

    return { success: true, url: r2Result.url, size: r2Result.size };
  },
});

export const migrateAllVersions = action({
  args: {},
  handler: async (ctx): Promise<MigrateAllResult> => {
    console.log("Starting versions migration...");

    const versions = await ctx.runQuery(internal.migration.getVersionsToMigrate, {});
    console.log(`Found ${versions.length} versions to migrate`);

    if (versions.length === 0) {
      return { success: true, message: "No versions need migration", migrated: 0, failed: 0 };
    }

    let migrated = 0;
    let failed = 0;

    for (const version of versions) {
      try {
        const result = await ctx.runAction(api.migration.migrateVersion, {
          versionId: version._id,
        });

        if (result.success) {
          migrated++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }

    return {
      success: failed === 0,
      message: `Versions migration: ${migrated} migrated, ${failed} failed`,
      migrated,
      failed,
    };
  },
});

// Get migrated versions that still have content
export const getMigratedVersions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const versions = await ctx.db.query("scriptVersions").collect();

    return versions
      .filter(v => v.contentUrl && v.content && v.content.length > 0)
      .map(v => ({
        _id: v._id,
        versionNumber: v.versionNumber,
        contentLength: v.content.length,
      }));
  },
});

// Clear version content
export const clearVersionContent = internalMutation({
  args: { versionId: v.id("scriptVersions") },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version || !version.contentUrl) {
      throw new Error("Version not migrated yet");
    }
    await ctx.db.patch(args.versionId, { content: "" });
  },
});

// Clear all migrated version content
export const clearAllMigratedVersions = action({
  args: {},
  handler: async (ctx): Promise<ClearResult> => {
    console.log("Clearing migrated version content from Convex...");

    const versions = await ctx.runQuery(internal.migration.getMigratedVersions, {});
    console.log(`Found ${versions.length} migrated versions to clear`);

    let cleared = 0;
    let failed = 0;

    for (const version of versions) {
      try {
        await ctx.runMutation(internal.migration.clearVersionContent, {
          versionId: version._id,
        });
        cleared++;
      } catch (error) {
        failed++;
      }
    }

    return {
      success: failed === 0,
      message: `Cleared ${cleared} versions, ${failed} failed`,
      cleared,
      failed,
    };
  },
});
