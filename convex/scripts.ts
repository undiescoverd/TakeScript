import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getStagesForUser } from "./kanban";

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
    stageId: v.optional(v.string()), // For Kanban quick create
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

    // Validate the target stage and place the script at the end of it,
    // using the same small-integer ordering scheme as updateStage/reorderInStage
    const stages = await getStagesForUser(ctx, user._id);
    const stageId =
      args.stageId && stages.some((s) => s.id === args.stageId)
        ? args.stageId
        : stages[0]?.id ?? "draft";

    const scriptsInStage = await ctx.db
      .query("scripts")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", user._id).eq("stageId", stageId)
      )
      .collect();
    const maxOrder = scriptsInStage.reduce(
      (max, s) => Math.max(max, s.stageOrder ?? 0),
      0
    );

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
      stageId,
      stageOrder: maxOrder + 1,
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

    // Owner-only access. Sharing (the schema's `sharedWith` field) is not
    // implemented yet — when it is, extend this check rather than opening reads
    // to every authenticated user.
    if (script.userId !== user._id) {
      return null;
    }

    return script;
  },
});

export const update = mutation({
  args: {
    scriptId: v.id("scripts"),
    content: v.string(),
    // Optimistic-concurrency baseline: the lastEditedAt the client observed
    // when it captured `content`. If the script has since changed server-side
    // (e.g. a version restore that raced an in-flight autosave), this write
    // is dropped instead of clobbering the newer content.
    expectedLastEditedAt: v.optional(v.number()),
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

    if (
      args.expectedLastEditedAt !== undefined &&
      script.lastEditedAt !== args.expectedLastEditedAt
    ) {
      return { applied: false, lastEditedAt: script.lastEditedAt };
    }

    const lastEditedAt = Date.now();
    await ctx.db.patch(args.scriptId, {
      content: args.content,
      lastEditedAt,
    });
    return { applied: true, lastEditedAt };
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

    // Delete all annotations
    const annotations = await ctx.db
      .query("annotations")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    for (const annotation of annotations) {
      await ctx.db.delete(annotation._id);
    }

    // Detach AI request analytics instead of deleting them — they're
    // billing/usage history, but must not point at a dead script id
    const aiRequests = await ctx.db
      .query("aiRequests")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    for (const request of aiRequests) {
      await ctx.db.patch(request._id, { scriptId: undefined });
    }

    // If deleting a folder, re-parent its children to the folder's own parent
    // so they don't become orphans pointing at a dead folder id
    if (script.isFolder) {
      const children = await ctx.db
        .query("scripts")
        .withIndex("by_user_and_parent", (q) =>
          q.eq("userId", user._id).eq("parentFolderId", args.scriptId)
        )
        .collect();

      for (const child of children) {
        await ctx.db.patch(child._id, { parentFolderId: script.parentFolderId });
      }
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

// Update a script's stage (Kanban)
export const updateStage = mutation({
  args: {
    scriptId: v.id("scripts"),
    stageId: v.string(),
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const stages = await getStagesForUser(ctx, user._id);
    if (!stages.some((s) => s.id === args.stageId)) {
      throw new Error("Invalid stage");
    }

    // Get max stageOrder in the target stage for positioning at end
    const scriptsInStage = await ctx.db
      .query("scripts")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", user._id).eq("stageId", args.stageId)
      )
      .collect();

    const maxOrder = scriptsInStage.reduce(
      (max, s) => Math.max(max, s.stageOrder ?? 0),
      0
    );

    await ctx.db.patch(args.scriptId, {
      stageId: args.stageId,
      stageOrder: maxOrder + 1,
      lastEditedAt: Date.now(),
    });
  },
});

// Move a script to a position within a stage (Kanban).
// Rewrites stageOrder for the whole target column as consecutive integers,
// which also repairs legacy values (undefined, colliding, or timestamp-scale).
export const reorderInStage = mutation({
  args: {
    scriptId: v.id("scripts"),
    stageId: v.string(),
    newIndex: v.number(),
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const stages = await getStagesForUser(ctx, user._id);
    if (!stages.some((s) => s.id === args.stageId)) {
      throw new Error("Invalid stage");
    }

    const scriptsInStage = await ctx.db
      .query("scripts")
      .withIndex("by_user_and_stage", (q) =>
        q.eq("userId", user._id).eq("stageId", args.stageId)
      )
      .collect();

    const ordered = scriptsInStage
      .filter((s) => s._id !== args.scriptId)
      .sort(
        (a, b) =>
          (a.stageOrder ?? 0) - (b.stageOrder ?? 0) || a.createdAt - b.createdAt
      );

    const insertIndex = Math.max(
      0,
      Math.min(Math.round(args.newIndex), ordered.length)
    );
    ordered.splice(insertIndex, 0, script);

    for (let i = 0; i < ordered.length; i++) {
      const isMoved = ordered[i]._id === args.scriptId;
      if (isMoved) {
        await ctx.db.patch(args.scriptId, {
          stageId: args.stageId,
          stageOrder: i,
          lastEditedAt: Date.now(),
        });
      } else if (ordered[i].stageOrder !== i) {
        await ctx.db.patch(ordered[i]._id, { stageOrder: i });
      }
    }
  },
});
