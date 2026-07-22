import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all comments for a script
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

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      return [];
    }

    // Get all comments for this script
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    // Enrich with user data
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const commentUser = await ctx.db.get(comment.userId);
        return {
          ...comment,
          user: commentUser
            ? {
                name: commentUser.name,
                avatar: commentUser.avatar,
                email: commentUser.email,
              }
            : null,
        };
      })
    );

    // Sort by creation date (newest first)
    return enrichedComments.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Create a new comment
export const create = mutation({
  args: {
    scriptId: v.id("scripts"),
    content: v.string(),
    position: v.string(), // Block ID or line number
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

    // Create comment
    const commentId = await ctx.db.insert("comments", {
      scriptId: args.scriptId,
      userId: user._id,
      content: args.content,
      position: args.position,
      resolved: false,
      createdAt: Date.now(),
    });

    return commentId;
  },
});

// Resolve/unresolve a comment
export const toggleResolve = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Verify script access
    const script = await ctx.db.get(comment.scriptId);
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
    await ctx.db.patch(args.commentId, {
      resolved: !comment.resolved,
    });
  },
});

// Delete a comment
export const remove = mutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Verify ownership or script ownership
    const script = await ctx.db.get(comment.scriptId);
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

    // Only comment author or script owner can delete
    if (comment.userId !== user._id && script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.commentId);
  },
});
