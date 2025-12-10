/**
 * Convex Actions for R2 Storage
 *
 * Convex actions can call external APIs (like R2).
 * These wrap the R2 utility functions for use in Convex mutations/queries.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upload script content to R2
 * Called from mutations that need to store content
 */
export const uploadScript = action({
  args: {
    scriptId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Dynamic import to avoid bundling issues
    const { uploadScriptContent } = await import("../lib/r2-storage");

    try {
      const r2Url = await uploadScriptContent(args.scriptId, args.content);
      return {
        success: true,
        url: r2Url,
        size: args.content.length,
      };
    } catch (error: any) {
      console.error("Failed to upload to R2:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Upload version snapshot to R2
 */
export const uploadVersion = action({
  args: {
    scriptId: v.string(),
    versionNumber: v.number(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { uploadVersionContent } = await import("../lib/r2-storage");

    try {
      const r2Url = await uploadVersionContent(
        args.scriptId,
        args.versionNumber,
        args.content
      );
      return {
        success: true,
        url: r2Url,
        size: args.content.length,
      };
    } catch (error: any) {
      console.error("Failed to upload version to R2:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Download content from R2
 * Called from queries that need to fetch content
 */
export const downloadContent = action({
  args: {
    r2Url: v.string(),
  },
  handler: async (ctx, args) => {
    const { downloadContent } = await import("../lib/r2-storage");

    try {
      const content = await downloadContent(args.r2Url);
      return {
        success: true,
        content,
      };
    } catch (error: any) {
      console.error("Failed to download from R2:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Delete content from R2
 */
export const deleteContent = action({
  args: {
    r2Url: v.string(),
  },
  handler: async (ctx, args) => {
    const { deleteContent } = await import("../lib/r2-storage");

    try {
      await deleteContent(args.r2Url);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to delete from R2:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * R2 health check
 */
export const healthCheck = action({
  args: {},
  handler: async (ctx, args) => {
    const { healthCheck } = await import("../lib/r2-storage");

    try {
      const healthy = await healthCheck();
      return { healthy };
    } catch (error: any) {
      console.error("R2 health check failed:", error);
      return { healthy: false, error: error.message };
    }
  },
});
