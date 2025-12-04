import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Welcome to this tutorial. In this guide, we'll cover..." },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Step 1: Getting Started", duration: "2m", id: generateBlockId("chapter") },
        },
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
        {
          type: "chapter",
          attrs: { title: "Step 2: Main Content", duration: "3m", id: generateBlockId("chapter") },
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Now let's dive into..." }],
        },
        {
          type: "editorNote",
          attrs: { id: generateBlockId("editorNote") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Remember to highlight key features here" },
              ],
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
        },
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
        {
          type: "chapter",
          attrs: { title: "Key Features", duration: "2m", id: generateBlockId("chapter") },
        },
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
    training: {
      type: "doc",
      content: [
        {
          type: "chapter",
          attrs: { title: "Training Overview", duration: "1m", id: generateBlockId("chapter") },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Welcome to this training session. Today we'll learn..." },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Core Concepts", duration: "3m", id: generateBlockId("chapter") },
        },
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
        {
          type: "chapter",
          attrs: { title: "Practice Exercise", duration: "4m", id: generateBlockId("chapter") },
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Now it's time to practice what you've learned..." },
          ],
        },
        {
          type: "editorNote",
          attrs: { id: generateBlockId("editorNote") },
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Add interactive exercises or quizzes here" },
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
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Welcome! Let's take a comprehensive tour of our product..." },
          ],
        },
        {
          type: "chapter",
          attrs: { title: "Feature 1: Dashboard", duration: "2m", id: generateBlockId("chapter") },
        },
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
        {
          type: "chapter",
          attrs: { title: "Feature 2: Analytics", duration: "2m", id: generateBlockId("chapter") },
        },
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
        {
          type: "chapter",
          attrs: { title: "Feature 3: Settings", duration: "1m", id: generateBlockId("chapter") },
        },
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
