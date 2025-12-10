import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Return types for actions
type SaveResult = Id<"scriptVersions">;
type VersionWithContent = {
  _id: Id<"scriptVersions">;
  _creationTime: number;
  scriptId: Id<"scripts">;
  versionNumber: number;
  content: string;
  contentUrl?: string;
  contentSize?: number;
  changedBy: Id<"users">;
  changeNote?: string;
  createdAt: number;
} | null;

// Internal mutation for saving version (called by action after R2 fetch)
export const saveInternal = internalMutation({
  args: {
    scriptId: v.id("scripts"),
    userId: v.id("users"),
    content: v.string(),
    changeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the latest version number
    const versions = await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    const latestVersion = versions.reduce(
      (max, v) => Math.max(max, v.versionNumber),
      0
    );

    // Create new version
    const versionId = await ctx.db.insert("scriptVersions", {
      scriptId: args.scriptId,
      versionNumber: latestVersion + 1,
      content: args.content,
      changedBy: args.userId,
      changeNote: args.changeNote,
      createdAt: Date.now(),
    });

    // Auto-cleanup: Keep only last 20 versions to save storage
    const MAX_VERSIONS = 20;
    if (versions.length >= MAX_VERSIONS) {
      const sortedVersions = versions.sort((a, b) => b.versionNumber - a.versionNumber);
      const versionsToDelete = sortedVersions.slice(MAX_VERSIONS - 1);

      for (const oldVersion of versionsToDelete) {
        await ctx.db.delete(oldVersion._id);
      }
    }

    return versionId;
  },
});

// Public action that fetches content from R2 if needed, then saves version
export const save = action({
  args: {
    scriptId: v.id("scripts"),
    changeNote: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SaveResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Fetch script with content from R2 if needed
    const script = await ctx.runAction(api.scripts.loadWithContent, {
      scriptId: args.scriptId,
    });

    if (!script) {
      throw new Error("Script not found");
    }

    // Get user
    const user = await ctx.runQuery(api.users.getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Save version with fetched content
    return await ctx.runMutation(internal.versions.saveInternal, {
      scriptId: args.scriptId,
      userId: user._id,
      content: script.content || "",
      changeNote: args.changeNote,
    });
  },
});

export const list = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return [];
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script || script.userId !== user._id) {
      return [];
    }

    const versions = await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    // Sort by version number descending (newest first)
    // Return only metadata - content fetched separately via loadVersionContent action
    return versions
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map(v => ({
        _id: v._id,
        _creationTime: v._creationTime,
        scriptId: v.scriptId,
        versionNumber: v.versionNumber,
        changedBy: v.changedBy,
        changeNote: v.changeNote,
        createdAt: v.createdAt,
        contentUrl: v.contentUrl,
        contentSize: v.contentSize,
        // Exclude content field to save bandwidth
      }));
  },
});

export const get = query({
  args: { versionId: v.id("scriptVersions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const version = await ctx.db.get(args.versionId);
    if (!version) {
      return null;
    }

    const script = await ctx.db.get(version.scriptId);
    if (!script) {
      return null;
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      return null;
    }

    return version;
  },
});

// Internal mutation for restoring a version (called by action after R2 fetch)
export const restoreInternal = internalMutation({
  args: {
    scriptId: v.id("scripts"),
    userId: v.id("users"),
    currentContent: v.string(),
    versionContent: v.string(),
    versionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Save current state as a new version before restoring
    const versions = await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    const latestVersion = versions.reduce(
      (max, v) => Math.max(max, v.versionNumber),
      0
    );

    await ctx.db.insert("scriptVersions", {
      scriptId: args.scriptId,
      versionNumber: latestVersion + 1,
      content: args.currentContent,
      changedBy: args.userId,
      changeNote: `Auto-saved before restoring to v${args.versionNumber}`,
      createdAt: Date.now(),
    });

    // Restore the old version
    await ctx.db.patch(args.scriptId, {
      content: args.versionContent,
      lastEditedAt: Date.now(),
    });
  },
});

// Public action that fetches content from R2 if needed, then restores version
export const restore = action({
  args: { versionId: v.id("scriptVersions") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get user
    const user = await ctx.runQuery(api.users.getByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get version with content from R2 if needed
    const version = await ctx.runAction(api.versions.loadVersionContent, {
      versionId: args.versionId,
    });

    if (!version) {
      throw new Error("Version not found");
    }

    // Get current script with content from R2 if needed
    const script = await ctx.runAction(api.scripts.loadWithContent, {
      scriptId: version.scriptId,
    });

    if (!script) {
      throw new Error("Script not found");
    }

    if (script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Restore with fetched content
    await ctx.runMutation(internal.versions.restoreInternal, {
      scriptId: version.scriptId,
      userId: user._id,
      currentContent: script.content || "",
      versionContent: version.content || "",
      versionNumber: version.versionNumber,
    });
  },
});

// Action to load version content from R2 (called when user views a version)
export const loadVersionContent = action({
  args: { versionId: v.id("scriptVersions") },
  handler: async (ctx, args): Promise<VersionWithContent> => {
    const version = await ctx.runQuery(api.versions.get, { versionId: args.versionId });
    if (!version) {
      return null;
    }

    // If content is in R2, fetch it
    if (version.contentUrl && (!version.content || version.content.length === 0)) {
      try {
        const r2Result = await ctx.runAction(api.r2.downloadContent, {
          r2Url: version.contentUrl,
        });
        if (r2Result.success && r2Result.content) {
          return { ...version, content: r2Result.content };
        }
      } catch (error) {
        console.error("Failed to load version content from R2:", error);
      }
    }

    return version;
  },
});
