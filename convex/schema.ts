import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    avatar: v.optional(v.string()),
    tokenIdentifier: v.string(),
  }).index("by_token", ["tokenIdentifier"]),

  scripts: defineTable({
    title: v.string(),
    userId: v.id("users"),
    content: v.string(), // JSON stringified Tiptap document
    lastEditedAt: v.number(),
    createdAt: v.number(),
    // New fields for Phase 2 (all optional for backward compatibility)
    templateType: v.optional(v.string()), // "tutorial" | "demo" | "training" | "product-walkthrough"
    targetLength: v.optional(v.number()), // Duration in minutes or page count
    targetType: v.optional(v.string()), // "pages" | "minutes"
    category: v.optional(v.string()), // Project/folder name
    status: v.optional(v.string()), // "draft" | "in-progress" | "complete" | "archived"
  })
    .index("by_user", ["userId"])
    .index("by_user_and_edited", ["userId", "lastEditedAt"])
    .index("by_user_and_category", ["userId", "category"]),

  scriptVersions: defineTable({
    scriptId: v.id("scripts"),
    versionNumber: v.number(),
    content: v.string(), // JSON stringified snapshot
    changedBy: v.id("users"),
    changeNote: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_script", ["scriptId", "versionNumber"]),

  comments: defineTable({
    scriptId: v.id("scripts"),
    userId: v.id("users"),
    content: v.string(),
    position: v.string(), // Block ID or position in document
    resolved: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_script", ["scriptId"])
    .index("by_script_unresolved", ["scriptId", "resolved"]),
});
