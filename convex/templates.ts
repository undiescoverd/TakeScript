import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper function to generate unique IDs for blocks
function generateBlockId(blockType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${blockType}-${timestamp}-${random}`;
}

// Helper function to sanitize template content by regenerating block IDs
// This ensures each instance of a template has unique IDs
function sanitizeTemplateContent(content: string): string {
  try {
    const parsed = JSON.parse(content);

    // Recursively traverse the document and regenerate IDs for custom blocks
    const regenerateIds = (node: any): any => {
      if (!node || typeof node !== "object") return node;

      // If this is a custom block with an ID attribute, regenerate it
      if (node.attrs?.id && node.type) {
        const blockTypes = ["chapter", "screenRecording", "demonstration", "editorNote"];
        if (blockTypes.includes(node.type)) {
          node.attrs.id = generateBlockId(node.type);
        }
      }

      // Recursively process content array
      if (Array.isArray(node.content)) {
        node.content = node.content.map(regenerateIds);
      }

      return node;
    };

    return JSON.stringify(regenerateIds(parsed));
  } catch (error) {
    console.error("Error sanitizing template content:", error);
    return content; // Return original if parsing fails
  }
}

// Create a new template from script content
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(), // JSON stringified Tiptap document
    category: v.optional(v.string()),
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

    // Sanitize content to regenerate IDs
    const sanitizedContent = sanitizeTemplateContent(args.content);

    const templateId = await ctx.db.insert("templates", {
      name: args.name,
      description: args.description,
      content: sanitizedContent,
      userId: user._id,
      category: args.category,
      isSystem: false,
      createdAt: Date.now(),
    });

    return templateId;
  },
});

// List all templates (user templates + system templates)
export const list = query({
  args: {},
  handler: async (ctx) => {
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

    // Get user templates
    const userTemplates = await ctx.db
      .query("templates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get system templates
    const systemTemplates = await ctx.db
      .query("templates")
      .withIndex("system_templates", (q) => q.eq("isSystem", true))
      .collect();

    // Combine and sort by creation date
    const allTemplates = [...userTemplates, ...systemTemplates];
    return allTemplates.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get a single template by ID
export const get = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return null;
    }

    // System templates are accessible to everyone
    if (template.isSystem) {
      return template;
    }

    // For user templates, verify authentication and ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || template.userId !== user._id) {
      return null;
    }

    return template;
  },
});

// Update a template's metadata or content
export const update = mutation({
  args: {
    templateId: v.id("templates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Can't modify system templates
    if (template.isSystem) {
      throw new Error("Cannot modify system templates");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || template.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Build update object
    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.content !== undefined) {
      updates.content = sanitizeTemplateContent(args.content);
    }

    await ctx.db.patch(args.templateId, updates);
  },
});

// Delete a user template
export const remove = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Can't delete system templates
    if (template.isSystem) {
      throw new Error("Cannot delete system templates");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || template.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.templateId);
  },
});

// Get only system templates
export const getSystemTemplates = query({
  args: {},
  handler: async (ctx) => {
    const systemTemplates = await ctx.db
      .query("templates")
      .withIndex("system_templates", (q) => q.eq("isSystem", true))
      .collect();

    return systemTemplates.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Update lastUsedAt timestamp when a template is used
export const markAsUsed = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return;
    }

    await ctx.db.patch(args.templateId, {
      lastUsedAt: Date.now(),
    });
  },
});

// Get template content for creating a new script (with sanitized IDs)
export const getTemplateContent = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return null;
    }

    // System templates are accessible to everyone
    if (template.isSystem) {
      return {
        content: sanitizeTemplateContent(template.content),
        name: template.name,
      };
    }

    // For user templates, verify authentication and ownership
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || template.userId !== user._id) {
      return null;
    }

    return {
      content: sanitizeTemplateContent(template.content),
      name: template.name,
    };
  },
});
