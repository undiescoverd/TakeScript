import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Organizations for multi-tenancy and team collaboration
  organizations: defineTable({
    name: v.string(),
    slug: v.string(), // URL-friendly identifier
    plan: v.optional(v.string()), // "free" | "pro" | "enterprise"
    // AI Settings - Using OpenRouter for unified access to all models
    aiProvider: v.optional(v.string()), // "openrouter" | "anthropic" (legacy)
    anthropicModel: v.optional(v.string()), // Legacy field
    openrouterModel: v.optional(v.string()), // Default: "anthropic/claude-3.5-sonnet"
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  users: defineTable({
    email: v.string(),
    name: v.string(),
    avatar: v.optional(v.string()),
    tokenIdentifier: v.string(),
    organizationId: v.optional(v.id("organizations")), // Link to organization (optional for migration)
    role: v.optional(v.string()), // "owner" | "admin" | "member" | "viewer"
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_organization", ["organizationId"]),

  // Organization invitations for team management
  organizationInvitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.string(), // "admin" | "member" | "viewer"
    token: v.string(), // Unique invite token
    invitedBy: v.id("users"),
    status: v.string(), // "pending" | "accepted" | "declined" | "expired"
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  scripts: defineTable({
    title: v.string(),
    userId: v.id("users"),
    content: v.string(), // JSON stringified Tiptap document (migrating to R2)
    contentUrl: v.optional(v.string()), // R2 URL: r2://bucket/key
    contentSize: v.optional(v.number()), // Size in bytes for monitoring
    contentHash: v.optional(v.string()), // SHA-256 hash for cache validation
    wordCount: v.optional(v.number()), // Cached word count for analytics
    lastEditedAt: v.number(),
    createdAt: v.number(),
    // New fields for Phase 2 (all optional for backward compatibility)
    templateType: v.optional(v.string()), // "tutorial" | "demo" | "training" | "product-walkthrough"
    targetLength: v.optional(v.number()), // Duration in minutes or page count
    targetType: v.optional(v.string()), // "pages" | "minutes"
    category: v.optional(v.string()), // Project/folder name
    status: v.optional(v.string()), // "draft" | "in-progress" | "complete" | "archived"
    organizationId: v.optional(v.id("organizations")), // Link to organization
    sharedWith: v.optional(v.array(v.id("users"))), // Specific users with access
    // Speaker data (stored with script for collaboration and reliability)
    speakers: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          color: v.string(),
          // Migration: old data has faceVisible (boolean), new data has defaultVisibility (string)
          faceVisible: v.optional(v.boolean()), // Deprecated - for migration only
          defaultVisibility: v.optional(v.string()), // "oncamera" | "corner" | "voiceover"
        })
      )
    ),
    // Folder organization fields
    parentFolderId: v.optional(v.id("scripts")), // null/undefined = root level
    isFolder: v.optional(v.boolean()), // true for folders, undefined/false for scripts
    // Kanban view fields
    stageId: v.optional(v.string()), // "draft" | "in-progress" | "review" | "ready" (or custom)
    stageOrder: v.optional(v.number()), // For ordering within columns (fractional indexing)
  })
    .index("by_user", ["userId"])
    .index("by_user_and_edited", ["userId", "lastEditedAt"])
    .index("by_user_and_category", ["userId", "category"])
    .index("by_organization", ["organizationId"])
    .index("by_user_and_parent", ["userId", "parentFolderId"])
    .index("by_user_and_stage", ["userId", "stageId"]),

  scriptVersions: defineTable({
    scriptId: v.id("scripts"),
    versionNumber: v.number(),
    content: v.string(), // JSON stringified snapshot (migrating to R2)
    contentUrl: v.optional(v.string()), // R2 URL: r2://bucket/key
    contentSize: v.optional(v.number()), // Size in bytes
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

  annotations: defineTable({
    scriptId: v.id("scripts"),
    userId: v.id("users"),
    content: v.string(), // The annotation note content
    selectedText: v.string(), // The text that was highlighted
    from: v.number(), // Start position in document
    to: v.number(), // End position in document
    color: v.string(), // Highlight color (e.g., "yellow", "green", "blue", "pink")
    resolved: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_script", ["scriptId"])
    .index("by_script_unresolved", ["scriptId", "resolved"]),

  templates: defineTable({
    name: v.string(), // Template name (required)
    description: v.optional(v.string()), // Optional description
    content: v.string(), // JSON stringified Tiptap document (required)
    userId: v.optional(v.id("users")), // Owner ID (null for system templates)
    category: v.optional(v.string()), // Optional category for organization
    isSystem: v.boolean(), // Boolean flag for built-in templates
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()), // Optional timestamp for tracking usage
  })
    .index("by_user", ["userId"])
    .index("by_category", ["category"])
    .index("system_templates", ["isSystem"]),

  // Brand guidelines for AI context
  brandGuidelines: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    content: v.string(), // Extracted plain text from file
    fileUrl: v.optional(v.string()), // Convex storage URL
    fileType: v.string(), // "pdf" | "docx" | "txt"
    uploadedBy: v.id("users"),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_active", ["organizationId", "isActive"]),

  // AI request tracking for analytics and billing
  aiRequests: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    scriptId: v.optional(v.id("scripts")),
    requestType: v.string(), // "chat" | "grammar" | "review" | "generation" | "inline"
    provider: v.string(), // "anthropic" | "openai"
    model: v.string(), // Model name used
    tokensUsed: v.optional(v.number()), // Token count if available
    cost: v.optional(v.number()), // USD cost estimate
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_script", ["scriptId"]),

  // Kanban stage customization per user
  kanbanStages: defineTable({
    userId: v.id("users"),
    stages: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        color: v.string(),
      })
    ),
  }).index("by_user", ["userId"]),
});
