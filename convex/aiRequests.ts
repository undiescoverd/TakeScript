import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getUserByTokenIdentifier } from "./users";

/**
 * Track AI request for analytics and billing
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    scriptId: v.optional(v.id("scripts")),
    requestType: v.string(), // "chat" | "grammar" | "review" | "generation" | "inline"
    provider: v.string(), // "anthropic" | "openai" | "openrouter"
    model: v.string(), // Model name used
    tokensUsed: v.optional(v.number()), // Token count if available
    cost: v.optional(v.number()), // USD cost estimate
  },
  handler: async (ctx, args) => {
    // Verify user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify user matches the userId in args
    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || user._id !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Create AI request record
    await ctx.db.insert("aiRequests", {
      userId: args.userId,
      organizationId: args.organizationId,
      scriptId: args.scriptId,
      requestType: args.requestType,
      provider: args.provider,
      model: args.model,
      tokensUsed: args.tokensUsed,
      cost: args.cost,
      createdAt: Date.now(),
    });
  },
});

