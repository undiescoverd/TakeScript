import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getUserByTokenIdentifier } from "./users";

/**
 * Track AI request for analytics and billing.
 *
 * `userId` and `organizationId` are derived from the authenticated caller,
 * never trusted from the client. `provider`, `model`, `tokensUsed`, and
 * `cost` remain self-reported by the caller (only it knows them) — they are
 * suitable for usage/analytics display but NOT for billing without
 * server-side metering.
 */
export const create = mutation({
  args: {
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

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) {
      throw new Error("Unauthorized");
    }
    if (!user.organizationId) {
      throw new Error("User has no organization");
    }

    if (args.scriptId) {
      const script = await ctx.db.get(args.scriptId);
      if (!script || script.userId !== user._id) {
        throw new Error("Not authorized");
      }
    }

    // Create AI request record
    await ctx.db.insert("aiRequests", {
      userId: user._id,
      organizationId: user.organizationId,
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

