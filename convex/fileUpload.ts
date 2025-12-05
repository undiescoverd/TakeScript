import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Generate upload URL for file storage
 * Used by client to upload files directly to Convex storage
 */
export const generateUploadUrl = action({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Extract text from uploaded file
 * Supports: TXT, PDF, DOCX
 */
export const extractTextFromFile = action({
  args: {
    storageId: v.id("_storage"),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    // Get file from storage
    const file = await ctx.storage.get(args.storageId);
    if (!file) throw new Error("File not found in storage");

    const blob = await file.blob();

    switch (args.fileType) {
      case "txt":
        return await blob.text();

      case "pdf":
        // PDF extraction using pdf-parse library
        try {
          const pdfParse = require('pdf-parse');
          const buffer = await blob.arrayBuffer();
          const data = await pdfParse(Buffer.from(buffer));
          return data.text;
        } catch (error) {
          throw new Error(`Failed to extract PDF: ${error}`);
        }

      case "docx":
        // DOCX extraction using mammoth library
        try {
          const mammoth = require('mammoth');
          const buffer = await blob.arrayBuffer();
          const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
          return result.value;
        } catch (error) {
          throw new Error(`Failed to extract DOCX: ${error}`);
        }

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
    const file = await ctx.storage.get(args.storageId);
    if (!file) return null;

    return {
      size: file.size,
      // Add more metadata as needed
    };
  },
});
