import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    // Helper to get a display name from identity
    const getDisplayName = () => {
      // Try different name fields that Clerk might provide
      // Clerk with Google OAuth may use: givenName, given_name, firstName, name
      const nameFields = [
        identity.givenName,
        identity.given_name,
        identity.firstName,
        identity.name,
        identity.nickname,
      ];

      for (const nameField of nameFields) {
        if (nameField && typeof nameField === 'string' && nameField.trim()) {
          return nameField.trim();
        }
      }

      // Fallback to email-based name
      if (identity.email && identity.email.trim()) {
        const emailLocal = identity.email.split("@")[0];
        return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
      }

      return "Anonymous";
    };

    // Check if we've already stored this identity before
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    const displayName = getDisplayName();

    if (user !== null) {
      // Migration: If existing user doesn't have an organization, create one
      if (!user.organizationId) {
        const orgId = await ctx.db.insert("organizations", {
          name: `${user.name}'s Workspace`,
          slug: user.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 50) + "-" + Date.now().toString(36),
          plan: "free",
          aiProvider: "anthropic",
          anthropicModel: "claude-sonnet-5",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.patch(user._id, {
          organizationId: orgId,
          role: "owner",
          name: displayName,
          email: identity.email ?? "",
          avatar: identity.pictureUrl,
        });

        return user._id;
      }

      // If we've seen this identity before but the name has changed, patch the value
      if (user.name !== displayName || user.email !== identity.email) {
        await ctx.db.patch(user._id, {
          name: displayName,
          email: identity.email ?? "",
          avatar: identity.pictureUrl,
        });
      }
      return user._id;
    }

    // If it's a new identity, create a new organization and user
    // Create personal organization first
    const orgId = await ctx.db.insert("organizations", {
      name: `${displayName}'s Workspace`,
      slug: displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) + "-" + Date.now().toString(36),
      plan: "free",
      aiProvider: "anthropic",
      anthropicModel: "claude-sonnet-5",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create user with organization as owner
    return await ctx.db.insert("users", {
      name: displayName,
      email: identity.email ?? "",
      avatar: identity.pictureUrl,
      tokenIdentifier: identity.tokenIdentifier,
      organizationId: orgId,
      role: "owner",
    });
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
  },
});

/**
 * Helper function to get user by token identifier
 * Used by other Convex functions to look up the current user
 * NOTE: This only works in queries/mutations (not actions)
 */
export async function getUserByTokenIdentifier(ctx: any, tokenIdentifier: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

/**
 * Query to get user by token identifier
 * Internal-only: called from actions via ctx.runQuery(internal.users.getByToken).
 * Must not be public — it would allow unauthenticated PII reads / user enumeration.
 */
export const getByToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
  },
});
