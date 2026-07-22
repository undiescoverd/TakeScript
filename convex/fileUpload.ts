"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

async function requireAuth(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity;
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
    await requireAuth(ctx);

    // Get file from storage
    const file = await ctx.storage.get(args.storageId);
    if (!file) throw new Error("File not found in storage");

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
    await requireAuth(ctx);
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
    await requireAuth(ctx);
    const file = await ctx.storage.get(args.storageId);
    if (!file) return null;

    return {
      size: file.size,
    };
  },
});
