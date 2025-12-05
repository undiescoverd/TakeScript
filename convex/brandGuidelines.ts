import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserByTokenIdentifier } from "./users";

/**
 * Upload new brand guideline
 * Deactivates other guidelines if this one is set as active
 */
export const upload = mutation({
  args: {
    name: v.string(),
    content: v.string(), // Pre-extracted text
    fileUrl: v.optional(v.string()),
    fileType: v.string(), // "pdf" | "docx" | "txt"
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) throw new Error("User not found");

    // Deactivate other guidelines if this is active
    if (args.isActive) {
      const existing = await ctx.db
        .query("brandGuidelines")
        .withIndex("by_organization_active", (q) =>
          q.eq("organizationId", user.organizationId).eq("isActive", true)
        )
        .collect();

      for (const guideline of existing) {
        await ctx.db.patch(guideline._id, { isActive: false });
      }
    }

    return await ctx.db.insert("brandGuidelines", {
      organizationId: user.organizationId,
      uploadedBy: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...args,
    });
  },
});

/**
 * List all brand guidelines for current user's organization
 */
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) throw new Error("User not found");

    return await ctx.db
      .query("brandGuidelines")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId))
      .order("desc")
      .collect();
  },
});

/**
 * Get active brand guideline for current user's organization
 */
export const getActive = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) return null;

    return await ctx.db
      .query("brandGuidelines")
      .withIndex("by_organization_active", (q) =>
        q.eq("organizationId", user.organizationId).eq("isActive", true)
      )
      .unique();
  },
});

/**
 * Set a guideline as active (deactivates others)
 */
export const setActive = mutation({
  args: { guidelineId: v.id("brandGuidelines") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) throw new Error("User not found");

    const guideline = await ctx.db.get(args.guidelineId);

    if (!guideline || guideline.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    // Deactivate all others
    const existing = await ctx.db
      .query("brandGuidelines")
      .withIndex("by_organization_active", (q) =>
        q.eq("organizationId", user.organizationId).eq("isActive", true)
      )
      .collect();

    for (const g of existing) {
      await ctx.db.patch(g._id, { isActive: false });
    }

    // Activate this one
    await ctx.db.patch(args.guidelineId, { isActive: true, updatedAt: Date.now() });
  },
});

/**
 * Update brand guideline
 */
export const update = mutation({
  args: {
    guidelineId: v.id("brandGuidelines"),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) throw new Error("User not found");

    const guideline = await ctx.db.get(args.guidelineId);

    if (!guideline || guideline.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name) updates.name = args.name;
    if (args.content) updates.content = args.content;

    await ctx.db.patch(args.guidelineId, updates);
  },
});

/**
 * Remove brand guideline
 */
export const remove = mutation({
  args: { guidelineId: v.id("brandGuidelines") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) throw new Error("User not found");

    const guideline = await ctx.db.get(args.guidelineId);

    if (!guideline || guideline.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.guidelineId);
  },
});
