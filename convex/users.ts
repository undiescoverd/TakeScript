import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

    // If it's a new identity, create a new User
    return await ctx.db.insert("users", {
      name: displayName,
      email: identity.email ?? "",
      avatar: identity.pictureUrl,
      tokenIdentifier: identity.tokenIdentifier,
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
