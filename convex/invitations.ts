import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserByTokenIdentifier } from "./users";

/**
 * Generate unique invite token
 */
function generateInviteToken(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create invitation to join organization
 * Only owners and admins can invite new members
 */
export const create = mutation({
  args: {
    email: v.string(),
    role: v.string(), // "admin" | "member" | "viewer"
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    // Only owners and admins can invite
    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("Only owners and admins can invite members");
    }

    // Check if user already exists in organization
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId))
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (existingUser) {
      throw new Error("User is already a member of this organization");
    }

    // Check for pending invitation
    const pendingInvite = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), user.organizationId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (pendingInvite) {
      throw new Error("Invitation already sent to this email");
    }

    // Validate role
    if (!["admin", "member", "viewer"].includes(args.role)) {
      throw new Error("Invalid role. Must be admin, member, or viewer");
    }

    const token = generateInviteToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const invitationId = await ctx.db.insert("organizationInvitations", {
      organizationId: user.organizationId,
      email: args.email,
      role: args.role,
      token,
      invitedBy: user._id,
      status: "pending",
      expiresAt,
      createdAt: Date.now(),
    });

    // TODO: Send invitation email with token
    // For MVP, return invitation link
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${token}`;

    return {
      invitationId,
      inviteLink,
    };
  },
});

/**
 * List all invitations for current user's organization
 */
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    return await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId))
      .order("desc")
      .collect();
  },
});

/**
 * Get invitation by token (public - no auth required)
 */
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return null;
    }

    // Don't return expired or already-processed invitations
    if (invitation.status !== "pending") {
      return null;
    }

    // Check if invitation has expired (don't try to patch in query - that's read-only)
    if (invitation.expiresAt < Date.now()) {
      // Return null for expired invitations - the accept mutation handles the actual status update
      return null;
    }

    // Return invitation with organization name
    const organization = await ctx.db.get(invitation.organizationId);

    return {
      ...invitation,
      organizationName: organization?.name,
    };
  },
});

/**
 * Accept invitation
 */
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      throw new Error("Invalid invitation");
    }

    if (invitation.status !== "pending") {
      throw new Error("Invitation already processed");
    }

    if (invitation.expiresAt < Date.now()) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Invitation expired");
    }

    if (invitation.email !== user.email) {
      throw new Error("Invitation is for a different email address");
    }

    // Update user's organization
    await ctx.db.patch(user._id, {
      organizationId: invitation.organizationId,
      role: invitation.role,
    });

    // Mark invitation as accepted
    await ctx.db.patch(invitation._id, { status: "accepted" });

    return { organizationId: invitation.organizationId };
  },
});

/**
 * Decline invitation
 */
export const decline = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      throw new Error("Invalid invitation");
    }

    await ctx.db.patch(invitation._id, { status: "declined" });
  },
});

/**
 * Revoke invitation (cancel pending invite)
 */
export const revoke = mutation({
  args: { invitationId: v.id("organizationInvitations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!user) throw new Error("User not found");

    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    if (user.role !== "owner" && user.role !== "admin") {
      throw new Error("Only owners and admins can revoke invitations");
    }

    await ctx.db.delete(args.invitationId);
  },
});

/**
 * Remove member from organization
 * Creates new personal organization for removed user
 */
export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const currentUser = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (!currentUser) throw new Error("User not found");

    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.organizationId !== currentUser.organizationId) {
      throw new Error("User not in same organization");
    }

    // Only owners can remove members
    if (currentUser.role !== "owner") {
      throw new Error("Only owners can remove members");
    }

    // Can't remove owner
    if (targetUser.role === "owner") {
      throw new Error("Cannot remove organization owner");
    }

    // Create new personal organization for removed user
    const orgId = await ctx.db.insert("organizations", {
      name: `${targetUser.name}'s Workspace`,
      slug: targetUser.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) + "-" + Date.now().toString(36),
      plan: "free",
      aiProvider: "anthropic",
      anthropicModel: "claude-sonnet-4-5-20250929",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Move user to new organization as owner
    await ctx.db.patch(args.userId, {
      organizationId: orgId,
      role: "owner",
    });
  },
});
