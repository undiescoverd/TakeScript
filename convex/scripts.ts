import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper function to generate template-specific initial content
function getTemplateContent(templateType?: string): string {
  const templates: Record<string, object> = {
    tutorial: {
      type: "doc",
      content: [
        {
          type: "chapter",
          attrs: { title: "Introduction", duration: 30, id: "intro" },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Welcome to this tutorial. In this guide, we'll cover..." },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Main Content", duration: 60, id: "main" },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "" }],
        },
      ],
    },
    demo: {
      type: "doc",
      content: [
        {
          type: "chapter",
          attrs: { title: "Demo Overview", duration: 30, id: "overview" },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "In this demo, we'll show you..." },
          ],
        },
        {
          type: "screenRecording",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Describe what viewers will see in the recording." },
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
          attrs: { title: "Training Session", duration: 60, id: "session" },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "This training will teach you..." },
          ],
        },
        {
          type: "demonstration",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Demonstrate the key concepts here." },
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
          attrs: { title: "Product Walkthrough", duration: 45, id: "walkthrough" },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Let's walk through the key features of..." },
          ],
        },
        {
          type: "screenRecording",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Show feature 1..." },
              ],
            },
          ],
        },
        {
          type: "screenRecording",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Show feature 2..." },
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
    templateType: v.optional(v.string()),
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
    const initialContent = getTemplateContent(args.templateType);

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

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      return null;
    }

    return script;
  },
});

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
