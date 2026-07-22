"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { MAX_GUIDELINE_FILE_BYTES } from "../lib/constants";

async function requireAuth(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
}

/**
 * Require that the authenticated caller is the one who uploaded this
 * storageId (recorded via fileUploads.recordUpload right after upload).
 * Being merely authenticated isn't enough here — without this, any logged-in
 * user could read, probe, or delete any file in storage by guessing/reusing
 * a storageId.
 */
async function requireFileOwnership(ctx: ActionCtx, storageId: Id<"_storage">) {
  const identity = await requireAuth(ctx);

  const user = await ctx.runQuery(internal.users.getByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) {
    throw new Error("User not found");
  }

  const owned = await ctx.runQuery(internal.fileUploads.isOwnedBy, {
    storageId,
    userId: user._id,
  });
  if (!owned) {
    throw new Error("Not authorized");
  }
}

/**
 * Generate upload URL for file storage
 * Used by client to upload files directly to Convex storage
 */
export const generateUploadUrl = action({
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Extract text from uploaded file
 * Currently only supports TXT files.
 * PDF and DOCX support temporarily disabled due to bundling issues.
 */
export const extractTextFromFile = action({
  args: {
    storageId: v.id("_storage"),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    await requireFileOwnership(ctx, args.storageId);

    // Get file from storage
    const file = await ctx.storage.get(args.storageId);
    if (!file) throw new Error("File not found in storage");

    // Backstop only. The real gate is in fileUploads.recordUpload, which every
    // upload hits before the flow branches on file type. This catches a direct
    // call to this action that skipped recordUpload.
    if (file.size > MAX_GUIDELINE_FILE_BYTES) {
      // The blob is already uploaded at this point — drop it before
      // rejecting, or we orphan the very file brandGuidelines.remove's
      // cleanup exists to prevent.
      await ctx.storage.delete(args.storageId);
      await ctx.runMutation(internal.fileUploads.removeByStorageId, {
        storageId: args.storageId,
      });
      throw new Error(
        `File exceeds the ${Math.floor(
          MAX_GUIDELINE_FILE_BYTES / (1024 * 1024)
        )}MB limit`
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    switch (args.fileType) {
      case "txt":
        // Convert ArrayBuffer to string for text files
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(arrayBuffer);

      case "pdf":
        // PDF extraction temporarily disabled
        // TODO: Re-enable when bundling issues are resolved
        throw new Error(
          "PDF extraction is temporarily disabled. Please upload a .txt file instead, or paste your brand guidelines directly."
        );

      case "docx":
        // DOCX extraction temporarily disabled
        // TODO: Re-enable when bundling issues are resolved
        throw new Error(
          "DOCX extraction is temporarily disabled. Please upload a .txt file instead, or paste your brand guidelines directly."
        );

      default:
        throw new Error(`Unsupported file type: ${args.fileType}`);
    }
  },
});

/**
 * Delete file from storage
 */
export const deleteFile = action({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireFileOwnership(ctx, args.storageId);
    await ctx.storage.delete(args.storageId);
  },
});

/**
 * Get file metadata
 */
export const getFileMetadata = action({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireFileOwnership(ctx, args.storageId);
    const file = await ctx.storage.get(args.storageId);
    if (!file) return null;

    return {
      size: file.size,
    };
  },
});
