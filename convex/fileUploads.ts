import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { MAX_GUIDELINE_FILE_BYTES } from "../lib/constants";

/**
 * Register ownership of a just-uploaded storage file. The client calls this
 * immediately after receiving a storageId from the upload URL POST, before
 * doing anything else with it (e.g. extracting text). This is what lets
 * fileUpload.ts's actions verify ownership, since Convex storage itself
 * doesn't track who uploaded a file.
 *
 * This is also where the upload size limit is enforced. It's the only
 * chokepoint every upload passes through *before* the flow branches on file
 * type: the dialog extracts .txt content client-side and never calls
 * extractTextFromFile for it, so a check living only in that action misses
 * TXT entirely. The client-side check in UploadGuidelinesDialog is a UX
 * nicety; this is the actual gate.
 *
 * NOTE: the limit is guideline-specific. If recordUpload ever serves another
 * upload flow with a different ceiling, parameterize it rather than letting
 * that flow inherit this one.
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

    // The blob is already in storage by the time we get here (the client POSTs
    // it to the upload URL, then calls this). So an oversized file must be
    // deleted before we reject it, or we orphan the very thing
    // brandGuidelines.remove's cleanup exists to prevent.
    const metadata = await ctx.db.system.get(args.storageId);
    if (metadata && metadata.size > MAX_GUIDELINE_FILE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error(
        `File exceeds the ${Math.floor(
          MAX_GUIDELINE_FILE_BYTES / (1024 * 1024)
        )}MB limit`
      );
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

/**
 * Internal-only: remove the ownership row for a storage file. Used when a
 * storage object is deleted (guideline removal, oversized-file rejection) so
 * the fileUploads table doesn't accumulate rows for files that no longer
 * exist. Called from fileUpload.ts's actions via ctx.runMutation, since
 * actions can't touch ctx.db directly.
 */
export const removeByStorageId = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("fileUploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
