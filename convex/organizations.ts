import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserByTokenIdentifier } from "./users";

/**
 * Generate URL-friendly slug from organization name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) + "-" + Date.now().toString(36);
}

/**
 * Create or get organization for current user
 * Auto-creates a personal workspace if user doesn't have one
 */
export const createOrGet = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    // If user already has an organization, return it
    if (user.organizationId) {
      return await ctx.db.get(user.organizationId);
    }

    // Create personal organization
    const orgId = await ctx.db.insert("organizations", {
      name: `${user.name}'s Workspace`,
      slug: generateSlug(user.name),
      plan: "free",
      aiProvider: "anthropic",
      anthropicModel: "claude-sonnet-4-5-20250929",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update user with organizationId and owner role
    await ctx.db.patch(user._id, {
      organizationId: orgId,
      role: "owner",
    });

    return await ctx.db.get(orgId);
  },
});

/**
 * Get organization by ID
 */
export const get = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    if (user.organizationId !== args.organizationId) {
      throw new Error("Not authorized to access this organization");
    }

    return await ctx.db.get(args.organizationId);
  },
});

/**
 * Get current user's organization
 */
export const getCurrent = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user || !user.organizationId) return null;

    return await ctx.db.get(user.organizationId);
  },
});

/**
 * Update organization details
 */
export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    if (user.organizationId !== args.organizationId) {
      throw new Error("Not authorized");
    }

    if (user.role !== "owner") {
      throw new Error("Only owners can update organization settings");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name) updates.name = args.name;

    await ctx.db.patch(args.organizationId, updates);
  },
});

/**
 * Update AI provider settings
 */
export const updateAISettings = mutation({
  args: {
    organizationId: v.id("organizations"),
    aiProvider: v.optional(v.string()),
    anthropicModel: v.optional(v.string()),
    openaiModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    if (user.organizationId !== args.organizationId) {
      throw new Error("Not authorized");
    }

    // Only owners and admins can update AI settings
    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("Only owners and admins can update AI settings");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.aiProvider) updates.aiProvider = args.aiProvider;
    if (args.anthropicModel) updates.anthropicModel = args.anthropicModel;
    if (args.openaiModel) updates.openaiModel = args.openaiModel;

    await ctx.db.patch(args.organizationId, updates);
  },
});

/**
 * Get all members of an organization
 */
export const getMembers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    if (user.organizationId !== args.organizationId) {
      throw new Error("Not authorized to view members");
    }

    return await ctx.db
      .query("users")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

/**
 * Update member role (owner only)
 */
export const updateMemberRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(), // "admin" | "member" | "viewer"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const currentUser = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!currentUser) throw new Error("User not found");

    if (currentUser.role !== "owner") {
      throw new Error("Only owners can update member roles");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("Target user not found");

    if (targetUser.organizationId !== currentUser.organizationId) {
      throw new Error("User not in same organization");
    }

    if (targetUser.role === "owner") {
      throw new Error("Cannot change owner role");
    }

    // Validate role
    if (!["admin", "member", "viewer"].includes(args.role)) {
      throw new Error("Invalid role");
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/**
 * Fix all organizations to use OpenRouter (one-time migration)
 * Run with: npx convex run organizations:migrateToOpenRouter
 */
export const migrateToOpenRouter = mutation({
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").collect();
    let updated = 0;

    for (const org of orgs) {
      if (org.aiProvider === "anthropic" || !org.aiProvider) {
        await ctx.db.patch(org._id, {
          aiProvider: "openrouter",
          openrouterModel: "anthropic/claude-3.5-sonnet",
          updatedAt: Date.now(),
        });
        updated++;
      }
    }

    return { updated, total: orgs.length };
  },
});
