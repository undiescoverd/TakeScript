import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

/** Max suggestions accepted in one AI batch, to bound the transaction. */
const MAX_AI_SUGGESTIONS_PER_BATCH = 50;

/**
 * Resolve the calling user and assert they own the script.
 *
 * Same checks the older mutations inline; factored out here so the AI batch
 * paths don't repeat the preamble three more times.
 */
async function requireScriptOwner(
  ctx: MutationCtx,
  scriptId: Id<"scripts">
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const script = await ctx.db.get(scriptId);
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

  return user;
}

// List all annotations for a script
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

    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user || script.userId !== user._id) {
      return [];
    }

    // Note: Queries are read-only and cannot modify the database
    // User info updates happen in mutations (create, update, etc.)

    // Get all annotations for this script
    const annotations = await ctx.db
      .query("annotations")
      .withIndex("by_script", (q) => q.eq("scriptId", args.scriptId))
      .collect();

    // Enrich with user data
    const enrichedAnnotations = await Promise.all(
      annotations.map(async (annotation) => {
        const annotationUser = await ctx.db.get(annotation.userId);
        return {
          ...annotation,
          // Rows predating AI suggestions have no authorType; they are human.
          authorType: annotation.authorType ?? "user",
          user: annotationUser
            ? {
                name: annotationUser.name,
                avatar: annotationUser.avatar,
                email: annotationUser.email,
              }
            : null,
        };
      })
    );

    // Sort by position in document
    return enrichedAnnotations.sort((a, b) => a.from - b.from);
  },
});

// Create a new annotation
export const create = mutation({
  args: {
    scriptId: v.id("scripts"),
    content: v.string(),
    selectedText: v.string(),
    from: v.number(),
    to: v.number(),
    color: v.string(),
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

    const now = Date.now();

    // Create annotation
    const annotationId = await ctx.db.insert("annotations", {
      scriptId: args.scriptId,
      userId: user._id,
      content: args.content,
      selectedText: args.selectedText,
      from: args.from,
      to: args.to,
      color: args.color,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });

    return annotationId;
  },
});

/**
 * Create a batch of AI-authored suggestions in one transaction.
 *
 * Positions are resolved client-side against the live editor doc and passed in;
 * this mutation never computes a ProseMirror position. Unanchored entries
 * (the resolver failed, or the model gave no quote) arrive with anchored:false
 * and from/to of 0 — they are kept, not dropped, and render as general notes.
 *
 * Returns the new IDs in input order so the caller can zip them against the
 * spans it resolved and apply the marks in one editor chain.
 */
export const createAISuggestions = mutation({
  args: {
    scriptId: v.id("scripts"),
    batchId: v.string(),
    model: v.string(),
    provider: v.string(),
    suggestions: v.array(
      v.object({
        content: v.string(),
        selectedText: v.string(),
        from: v.number(),
        to: v.number(),
        anchored: v.boolean(),
        suggestionType: v.optional(
          v.union(
            v.literal("grammar"),
            v.literal("spelling"),
            v.literal("style"),
            v.literal("tone"),
            v.literal("clarity"),
            v.literal("structure"),
            v.literal("pacing")
          )
        ),
        suggestedText: v.optional(v.string()),
        severity: v.optional(
          v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
        ),
      })
    ),
  },
  handler: async (ctx, args): Promise<Id<"annotations">[]> => {
    const user = await requireScriptOwner(ctx, args.scriptId);

    if (args.suggestions.length > MAX_AI_SUGGESTIONS_PER_BATCH) {
      throw new Error(
        `Too many suggestions in one batch (max ${MAX_AI_SUGGESTIONS_PER_BATCH})`
      );
    }

    const now = Date.now();
    const ids: Id<"annotations">[] = [];

    for (const s of args.suggestions) {
      ids.push(
        await ctx.db.insert("annotations", {
          scriptId: args.scriptId,
          // The triggering human, not a synthetic AI user — keeps every
          // existing ownership check working.
          userId: user._id,
          content: s.content,
          selectedText: s.selectedText,
          from: s.from,
          to: s.to,
          color: "ai",
          resolved: false,
          createdAt: now,
          updatedAt: now,
          authorType: "ai",
          aiModel: args.model,
          aiProvider: args.provider,
          suggestionType: s.suggestionType,
          suggestedText: s.suggestedText,
          severity: s.severity,
          status: "open",
          anchored: s.anchored,
          batchId: args.batchId,
        })
      );
    }

    return ids;
  },
});

/**
 * Mark an AI suggestion applied or dismissed.
 *
 * Sets `resolved: true` alongside `status` so the row drops into the panel's
 * existing "Resolved" section without that code needing to know about status.
 */
async function setAIStatus(
  ctx: MutationCtx,
  annotationId: Id<"annotations">,
  status: "applied" | "dismissed"
) {
  const annotation = await ctx.db.get(annotationId);
  if (!annotation) {
    throw new Error("Annotation not found");
  }

  await requireScriptOwner(ctx, annotation.scriptId);

  await ctx.db.patch(annotationId, {
    status,
    resolved: true,
    updatedAt: Date.now(),
  });
}

export const markApplied = mutation({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    await setAIStatus(ctx, args.annotationId, "applied");
  },
});

export const dismiss = mutation({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    await setAIStatus(ctx, args.annotationId, "dismissed");
  },
});

/**
 * Mark many suggestions applied in ONE transaction.
 *
 * "Apply all" edits the document in a single undo step; settling the rows one
 * mutation at a time would reopen exactly the gap that avoids — a failure
 * halfway through leaves some rows applied and others still open, with no
 * record of which. One mutation means the database either agrees with the
 * editor or is untouched.
 *
 * Ownership is checked once per distinct script rather than once per row: the
 * ids in a batch come from a single script in every real call, so the memo
 * turns N identical auth round-trips into one while still refusing a
 * hand-crafted call that mixes in someone else's annotation.
 */
/**
 * Extracted so the memo's auth control flow is unit-testable without spinning
 * up the whole Convex runtime — the mutation wrapper below is the only thing
 * registered as an endpoint. See convex/annotations.markAppliedBatch.test.ts.
 */
export async function markAppliedBatchHandler(
  ctx: MutationCtx,
  args: { annotationIds: Id<"annotations">[] }
) {
  if (args.annotationIds.length > MAX_AI_SUGGESTIONS_PER_BATCH) {
    throw new Error(
      `Too many annotations in one batch (max ${MAX_AI_SUGGESTIONS_PER_BATCH})`
    );
  }

  const checkedScripts = new Set<string>();
  const now = Date.now();

  for (const annotationId of args.annotationIds) {
    const annotation = await ctx.db.get(annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    if (!checkedScripts.has(annotation.scriptId)) {
      await requireScriptOwner(ctx, annotation.scriptId);
      checkedScripts.add(annotation.scriptId);
    }

    await ctx.db.patch(annotationId, {
      status: "applied",
      resolved: true,
      updatedAt: now,
    });
  }
}

export const markAppliedBatch = mutation({
  args: { annotationIds: v.array(v.id("annotations")) },
  handler: markAppliedBatchHandler,
});

// Update annotation content
export const update = mutation({
  args: {
    annotationId: v.id("annotations"),
    content: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script access
    const script = await ctx.db.get(annotation.scriptId);
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

    // Update annotation
    const updates: { content?: string; color?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.content !== undefined) {
      updates.content = args.content;
    }
    if (args.color !== undefined) {
      updates.color = args.color;
    }

    await ctx.db.patch(args.annotationId, updates);
  },
});

// Update annotation position (when document changes)
export const updatePosition = mutation({
  args: {
    annotationId: v.id("annotations"),
    from: v.number(),
    to: v.number(),
    selectedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script access
    const script = await ctx.db.get(annotation.scriptId);
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

    // Update position
    const updates: {
      from: number;
      to: number;
      selectedText?: string;
      updatedAt: number;
    } = {
      from: args.from,
      to: args.to,
      updatedAt: Date.now(),
    };

    if (args.selectedText !== undefined) {
      updates.selectedText = args.selectedText;
    }

    await ctx.db.patch(args.annotationId, updates);
  },
});

// Resolve/unresolve an annotation
export const toggleResolve = mutation({
  args: {
    annotationId: v.id("annotations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script access
    const script = await ctx.db.get(annotation.scriptId);
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
    await ctx.db.patch(args.annotationId, {
      resolved: !annotation.resolved,
      updatedAt: Date.now(),
    });
  },
});

// Delete an annotation
export const remove = mutation({
  args: {
    annotationId: v.id("annotations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) {
      throw new Error("Annotation not found");
    }

    // Verify script ownership
    const script = await ctx.db.get(annotation.scriptId);
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

    // Only annotation author or script owner can delete
    if (annotation.userId !== user._id && script.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Replies live in their own table, so they must be cleaned up explicitly
    // or they outlive the annotation they belong to.
    const replies = await ctx.db
      .query("annotationReplies")
      .withIndex("by_annotation", (q) =>
        q.eq("annotationId", args.annotationId)
      )
      .collect();

    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    await ctx.db.delete(args.annotationId);
  },
});
