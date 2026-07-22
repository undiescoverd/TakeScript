import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all annotations for a script
export const list = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Verify script access
    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      return [];
    }

    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      return [];
    }

    // Note: Queries are read-only and cannot modify the database
    // User info updates happen in mutations (create, update, etc.)

    // Get all annotations for this script
    const annotations = await ctx.db
      .query("annotations")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    // Enrich with user data
    const enrichedAnnotations = await Promise.all(
      annotations.map(async (annotation) => {
        const annotationUser = await ctx.db.get(annotation.userId);
        return {
          ...annotation,
          user: annotationUser
            ? {
                name: annotationUser.name,
                avatar: annotationUser.avatar,
                email: annotationUser.email,
              }
            : null,
        };
      })
    );

    // Sort by position in document
    return enrichedAnnotations.sort((a, b) => a.from - b.from);
  },
});

// Create a new annotation
export const create = mutation({
  args: {
    scriptId: v.id("scripts"),
    content: v.string(),
    selectedText: v.string(),
    from: v.number(),
    to: v.number(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify script access
    const script = await ctx.db.get(args.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    // Users are provisioned (with organization and role) by users.store at
    // login — creating them here would drift from that and a brand-new user
    // could never own the script anyway.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const now = Date.now();

    // Create annotation
    const annotationId = await ctx.db.insert("annotations", {
      scriptId: args.scriptId,
      userId: user._id,
      content: args.content,
      selectedText: args.selectedText,
      from: args.from,
      to: args.to,
      color: args.color,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });

    return annotationId;
  },
});

// Update annotation content
export const update = mutation({
  args: {
    annotationId: v.id("annotations"),
    content: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script access
    const script = await ctx.db.get(annotation.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Update annotation
    const updates: { content?: string; color?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.content !== undefined) {
      updates.content = args.content;
    }
    if (args.color !== undefined) {
      updates.color = args.color;
    }

    await ctx.db.patch(args.annotationId, updates);
  },
});

// Update annotation position (when document changes)
export const updatePosition = mutation({
  args: {
    annotationId: v.id("annotations"),
    from: v.number(),
    to: v.number(),
    selectedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script access
    const script = await ctx.db.get(annotation.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Update position
    const updates: {
      from: number;
      to: number;
      selectedText?: string;
      updatedAt: number;
    } = {
      from: args.from,
      to: args.to,
      updatedAt: Date.now(),
    };

    if (args.selectedText !== undefined) {
      updates.selectedText = args.selectedText;
    }

    await ctx.db.patch(args.annotationId, updates);
  },
});

// Resolve/unresolve an annotation
export const toggleResolve = mutation({
  args: {
    annotationId: v.id("annotations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script access
    const script = await ctx.db.get(annotation.scriptId);
    if (!script) {
      throw new Error("Script not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Toggle resolved status
    await ctx.db.patch(args.annotationId, {
      resolved: !annotation.resolved,
      updatedAt: Date.now(),
    });
  },
});

// Delete an annotation
export const remove = mutation({
  args: {
    annotationId: v.id("annotations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script ownership
    const script = await ctx.db.get(annotation.scriptId);
    if (!script) {
      throw new Error("Script not found");
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

    // Only annotation author or script owner can delete
    if (annotation.userId !== user._id && script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.annotationId);
  },
});
