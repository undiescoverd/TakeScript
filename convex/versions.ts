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

    // Get the latest version number via the index (sorted by versionNumber)
    const latest = await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .order("desc")
      .first();

    const latestVersion = latest?.versionNumber ?? 0;

    // Create new version
    const versionId = await ctx.db.insert("scriptVersions", {
      scriptId: args.scriptId,
      versionNumber: latestVersion + 1,
      content: script.content,
      changedBy: user._id,
      changeNote: args.changeNote,
      createdAt: Date.now(),
    });

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

    // Index is [scriptId, versionNumber], so desc order = newest first
    return await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .order("desc")
      .collect();
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
    const latest = await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", script._id))
      .order("desc")
      .first();

    const latestVersion = latest?.versionNumber ?? 0;

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
