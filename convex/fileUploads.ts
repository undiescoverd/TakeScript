import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";

/**
 * Register ownership of a just-uploaded storage file. The client calls this
 * immediately after receiving a storageId from the upload URL POST, before
 * doing anything else with it (e.g. extracting text). This is what lets
 * fileUpload.ts's actions verify ownership, since Convex storage itself
 * doesn't track who uploaded a file.
 */
export const recordUpload = mutation({
  args: { storageId: v.id("_storage") },
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

    const existing = await ctx.db
      .query("fileUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();

    if (existing) {
      // Each generateUploadUrl() call produces a fresh, unique storageId, so
      // this should never legitimately fire for a different user.
      if (existing.userId !== user._id) {
        throw new Error("Storage id already claimed");
      }
      return;
    }

    await ctx.db.insert("fileUploads", {
      storageId: args.storageId,
      userId: user._id,
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal-only: whether the given user owns (uploaded) the given storage
 * file. Called from fileUpload.ts's node actions via ctx.runQuery.
 */
export const isOwnedBy = internalQuery({
  args: { storageId: v.id("_storage"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("fileUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();

    return record?.userId === args.userId;
  },
});
