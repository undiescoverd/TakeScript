import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const save = mutation({
  args: {
    scriptId: v.id("scripts"),
    changeNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    if (script.userId !== user._id) {
      throw new Error("Not authorized");
    }

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
      content: script.content,
      changedBy: user._id,
      changeNote: args.changeNote,
      createdAt: Date.now(),
    });

    // Auto-cleanup: Keep only last 20 versions to save storage
    const MAX_VERSIONS = 20;
    if (versions.length >= MAX_VERSIONS) {
      // Sort by version number and delete oldest ones
      const sortedVersions = versions.sort((a, b) => b.versionNumber - a.versionNumber);
      const versionsToDelete = sortedVersions.slice(MAX_VERSIONS - 1); // Keep 19, new one makes 20

      for (const oldVersion of versionsToDelete) {
        await ctx.db.delete(oldVersion._id);
      }
    }

    return versionId;
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
    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
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

export const restore = mutation({
  args: { versionId: v.id("scriptVersions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const version = await ctx.db.get(args.versionId);
    if (!version) {
      throw new Error("Version not found");
    }

    const script = await ctx.db.get(version.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    if (script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Save current state as a new version before restoring
    const versions = await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", script._id))
      .collect();

    const latestVersion = versions.reduce(
      (max, v) => Math.max(max, v.versionNumber),
      0
    );

    await ctx.db.insert("scriptVersions", {
      scriptId: script._id,
      versionNumber: latestVersion + 1,
      content: script.content,
      changedBy: user._id,
      changeNote: `Auto-saved before restoring to v${version.versionNumber}`,
      createdAt: Date.now(),
    });

    // Restore the old version
    await ctx.db.patch(script._id, {
      content: version.content,
      lastEditedAt: Date.now(),
    });
  },
});
