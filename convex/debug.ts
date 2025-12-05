import { mutation, query } from "./_generated/server";

// Debug query to check current user identity data
export const checkIdentity = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { error: "Not authenticated" };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    return {
      identity: {
        tokenIdentifier: identity.tokenIdentifier,
        email: identity.email,
        name: identity.name,
        givenName: (identity as any).givenName,
        given_name: (identity as any).given_name,
        firstName: (identity as any).firstName,
        familyName: (identity as any).familyName,
        nickname: (identity as any).nickname,
        pictureUrl: identity.pictureUrl,
        allFields: Object.keys(identity),
      },
      userInDb: user,
    };
  },
});

// Force update current user's name from Clerk identity
export const forceUpdateUserName = mutation({
  handler: async (ctx) => {
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
      throw new Error("User not found in database");
    }

    // Helper to get a display name from identity
    const getDisplayName = () => {
      const nameFields = [
        (identity as any).givenName,
        (identity as any).given_name,
        (identity as any).firstName,
        identity.name,
        (identity as any).nickname,
      ];

      for (const nameField of nameFields) {
        if (nameField && typeof nameField === 'string' && nameField.trim()) {
          return nameField.trim();
        }
      }

      if (identity.email && identity.email.trim()) {
        const emailLocal = identity.email.split("@")[0];
        return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
      }

      return "Anonymous";
    };

    const displayName = getDisplayName();

    await ctx.db.patch(user._id, {
      name: displayName,
      email: identity.email ?? user.email,
      avatar: identity.pictureUrl ?? user.avatar,
    });

    return {
      message: "User updated successfully",
      oldName: user.name,
      newName: displayName,
      identityFields: {
        givenName: (identity as any).givenName,
        given_name: (identity as any).given_name,
        firstName: (identity as any).firstName,
        name: identity.name,
        nickname: (identity as any).nickname,
      },
    };
  },
});
