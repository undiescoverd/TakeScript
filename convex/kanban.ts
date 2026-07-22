import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
// Single source of truth for default stages, shared with the client
import { DEFAULT_STAGES } from "../types/kanban";

// Resolve the stage list for a user (custom config or defaults).
// Used by scripts.ts mutations to validate stageId args.
export async function getStagesForUser(ctx: QueryCtx, userId: Id<"users">) {
  const kanbanConfig = await ctx.db
    .query("kanbanStages")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  return kanbanConfig?.stages ?? DEFAULT_STAGES;
}

// Get user's stages, creating defaults if none exist
export const getOrCreateStages = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return DEFAULT_STAGES;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return DEFAULT_STAGES;
    }

    const kanbanConfig = await ctx.db
      .query("kanbanStages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!kanbanConfig) {
      return DEFAULT_STAGES;
    }

    return kanbanConfig.stages;
  },
});

// Update all stage names/colors
export const updateStages = mutation({
  args: {
    stages: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        color: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (args.stages.length === 0) {
      throw new Error("At least one stage is required");
    }
    if (new Set(args.stages.map((s) => s.id)).size !== args.stages.length) {
      throw new Error("Stage ids must be unique");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Find existing config
    const existing = await ctx.db
      .query("kanbanStages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, { stages: args.stages });
    } else {
      // Create new
      await ctx.db.insert("kanbanStages", {
        userId: user._id,
        stages: args.stages,
      });
    }
  },
});

// Reset stages to defaults
export const resetToDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Find existing config
    const existing = await ctx.db
      .query("kanbanStages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { stages: DEFAULT_STAGES });
    } else {
      await ctx.db.insert("kanbanStages", {
        userId: user._id,
        stages: DEFAULT_STAGES,
      });
    }

    return DEFAULT_STAGES;
  },
});
