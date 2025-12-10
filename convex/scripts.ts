import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

// Helper function to generate unique IDs for blocks
function generateBlockId(blockType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${blockType}-${timestamp}-${random}`;
}

// Helper function to generate template-specific initial content
function getTemplateContent(templateType?: string): string {
  const templates: Record<string, object> = {
    tutorial: {
      type: "doc",
      content: [
        {
          type: "chapter",
          attrs: { title: "Introduction", duration: "30s", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Welcome to this tutorial. In this guide, we'll cover..." },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Step 1: Getting Started", duration: "2m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First, let's start by..." }],
            },
            {
              type: "screenRecording",
              attrs: { id: generateBlockId("screenRecording") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Show the initial setup process..." },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Step 2: Main Content", duration: "3m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Now let's dive into..." }],
            },
          ],
        },
      ],
    },
    demo: {
      type: "doc",
      content: [
        {
          type: "chapter",
          attrs: { title: "Product Demo", duration: "1m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "In this demo, we'll show you how our product solves..." },
              ],
            },
            {
              type: "screenRecording",
              attrs: { id: generateBlockId("screenRecording") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Navigate to the main dashboard and show..." },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Key Features", duration: "2m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Let's explore the key features..." },
              ],
            },
            {
              type: "screenRecording",
              attrs: { id: generateBlockId("screenRecording") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Demonstrate feature 1..." },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    training: {
      type: "doc",
      content: [
        {
          type: "chapter",
          attrs: { title: "Training Overview", duration: "1m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Welcome to this training session. Today we'll learn..." },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Core Concepts", duration: "3m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Let's start with the fundamental concepts..." },
              ],
            },
            {
              type: "demonstration",
              attrs: { id: generateBlockId("demonstration") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Demonstrate the core workflow step-by-step..." },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Practice Exercise", duration: "4m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Now it's time to practice what you've learned..." },
              ],
            },
          ],
        },
      ],
    },
    "product-walkthrough": {
      type: "doc",
      content: [
        {
          type: "chapter",
          attrs: { title: "Product Introduction", duration: "1m", id: generateBlockId("chapter") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Welcome! Let's take a comprehensive tour of our product..." },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Feature 1: Dashboard", duration: "2m", id: generateBlockId("chapter") },
          content: [
            {
              type: "screenRecording",
              attrs: { id: generateBlockId("screenRecording") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Show the dashboard overview and key metrics..." },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Feature 2: Analytics", duration: "2m", id: generateBlockId("chapter") },
          content: [
            {
              type: "screenRecording",
              attrs: { id: generateBlockId("screenRecording") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Navigate to analytics and explain data visualization..." },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Feature 3: Settings", duration: "1m", id: generateBlockId("chapter") },
          content: [
            {
              type: "screenRecording",
              attrs: { id: generateBlockId("screenRecording") },
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Show customization options and preferences..." },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  // Return template content or default empty document
  return JSON.stringify(
    templates[templateType as keyof typeof templates] || {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "" }],
        },
      ],
    }
  );
}

export const create = mutation({
  args: {
    title: v.string(),
    templateType: v.optional(v.string()), // Backward compatibility
    templateId: v.optional(v.id("templates")), // New template system
    targetLength: v.optional(v.number()),
    targetType: v.optional(v.string()),
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

    const now = Date.now();
    let initialContent: string;

    // Try to get content from template ID first (new system)
    if (args.templateId) {
      const template = await ctx.db.get(args.templateId);
      if (template) {
        // Sanitize template content to regenerate block IDs
        initialContent = sanitizeTemplateContent(template.content);

        // Update lastUsedAt timestamp for the template
        await ctx.db.patch(args.templateId, {
          lastUsedAt: now,
        });
      } else {
        // Template not found, use default
        initialContent = getTemplateContent();
      }
    } else {
      // Fall back to old templateType system
      initialContent = getTemplateContent(args.templateType);
    }

    const scriptId = await ctx.db.insert("scripts", {
      title: args.title,
      userId: user._id,
      content: initialContent,
      templateType: args.templateType,
      targetLength: args.targetLength,
      targetType: args.targetType,
      category: args.category,
      status: "draft",
      lastEditedAt: now,
      createdAt: now,
    });

    return scriptId;
  },
});

// Helper function to sanitize template content (duplicate from templates.ts for use here)
function sanitizeTemplateContent(content: string): string {
  try {
    const parsed = JSON.parse(content);

    // Recursively traverse the document and regenerate IDs for custom blocks
    const regenerateIds = (node: any): any => {
      if (!node || typeof node !== "object") return node;

      // If this is a custom block with an ID attribute, regenerate it
      if (node.attrs?.id && node.type) {
        const blockTypes = ["chapter", "screenRecording", "demonstration"];
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

    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by lastEditedAt descending
    return scripts.sort((a, b) => b.lastEditedAt - a.lastEditedAt);
  },
});

export const get = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      return null;
    }

    // Get the current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return null;
    }

    // Allow access if user is the owner OR if they're authenticated (for collaboration)
    // This enables sharing - any authenticated user can view the script
    // Write permissions are still restricted to owners in mutations
    if (script.userId !== user._id) {
      // User is not the owner, but they're authenticated
      // Allow read access for collaboration
      return script;
    }

    return script;
  },
});

// Action to load script with content from R2
export const loadWithContent = action({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    if (!script) {
      return null;
    }

    // If content is in R2, fetch it
    if (script.contentUrl && (!script.content || script.content.length === 0)) {
      try {
        const r2Result = await ctx.runAction(api.r2.downloadContent, {
          r2Url: script.contentUrl,
        });
        if (r2Result.success && r2Result.content) {
          return { ...script, content: r2Result.content };
        }
      } catch (error) {
        console.error("Failed to load content from R2:", error);
      }
    }

    // Return script as-is (content already present or R2 fetch failed)
    return script;
  },
});

// Internal mutation for updating script with R2 URL
export const updateInternal = internalMutation({
  args: {
    scriptId: v.id("scripts"),
    content: v.string(),
    contentUrl: v.optional(v.string()),
    contentSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scriptId, {
      content: args.content, // Keep for backward compat
      contentUrl: args.contentUrl,
      contentSize: args.contentSize,
      lastEditedAt: Date.now(),
    });
  },
});

// Simple mutation for updating script content (used by autosave)
export const update = mutation({
  args: {
    scriptId: v.id("scripts"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.scriptId, {
      content: args.content,
      lastEditedAt: Date.now(),
    });
  },
});

// Action wrapper for update with R2 (for future use when R2 is configured)
export const updateWithR2 = action({
  args: {
    scriptId: v.id("scripts"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const script = await ctx.runQuery(api.scripts.get, { scriptId: args.scriptId });
    if (!script) {
      throw new Error("Script not found");
    }

    const user = await ctx.runQuery(api.users.getByToken, {
      tokenIdentifier: identity.tokenIdentifier
    });

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Upload to R2
    const r2Result = await ctx.runAction(api.r2.uploadScript, {
      scriptId: args.scriptId,
      content: args.content,
    });

    if (!r2Result.success) {
      // Fallback: save to Convex if R2 fails
      console.error("R2 upload failed, falling back to Convex:", r2Result.error);
      await ctx.runMutation(internal.scripts.updateInternal, {
        scriptId: args.scriptId,
        content: args.content,
      });
      return;
    }

    // Update database with R2 URL
    await ctx.runMutation(internal.scripts.updateInternal, {
      scriptId: args.scriptId,
      content: args.content, // Keep for backward compat
      contentUrl: r2Result.url,
      contentSize: r2Result.size,
    });
  },
});

export const updateTitle = mutation({
  args: {
    scriptId: v.id("scripts"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.scriptId, {
      title: args.title,
      lastEditedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Delete all versions first
    const versions = await ctx.db
      .query("scriptVersions")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    // Delete all comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete the script
    await ctx.db.delete(args.scriptId);
  },
});

// Update speakers for a script
export const updateSpeakers = mutation({
  args: {
    scriptId: v.id("scripts"),
    speakers: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        color: v.string(),
        defaultVisibility: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.scriptId, {
      speakers: args.speakers,
      lastEditedAt: Date.now(),
    });
  },
});
