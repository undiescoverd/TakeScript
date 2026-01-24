import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";

const MAX_FOLDER_DEPTH = 5;

// Helper: Get user from auth identity
async function getAuthenticatedUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

// Helper: Calculate folder depth by traversing parent chain
async function getFolderDepth(ctx: any, folderId: Id<"scripts"> | null): Promise<number> {
  if (!folderId) return 0;

  let depth = 0;
  let currentId: Id<"scripts"> | null | undefined = folderId;

  while (currentId) {
    const folder: Doc<"scripts"> | null = await ctx.db.get(currentId);
    if (!folder) break;
    depth++;
    currentId = folder.parentFolderId;

    // Safety check to prevent infinite loops
    if (depth > MAX_FOLDER_DEPTH + 1) break;
  }

  return depth;
}

// Helper: Check if moving would create a circular reference
async function wouldCreateCircularReference(
  ctx: any,
  itemId: Id<"scripts">,
  targetParentId: Id<"scripts"> | null
): Promise<boolean> {
  if (!targetParentId) return false;
  if (itemId === targetParentId) return true;

  let currentId: Id<"scripts"> | null | undefined = targetParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) return true;
    if (currentId === itemId) return true;
    visited.add(currentId);

    const folder: Doc<"scripts"> | null = await ctx.db.get(currentId);
    if (!folder) break;
    currentId = folder.parentFolderId;
  }

  return false;
}

// Create a new folder
export const createFolder = mutation({
  args: {
    title: v.string(),
    parentFolderId: v.optional(v.id("scripts")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    // Validate parent folder if provided
    if (args.parentFolderId) {
      const parentFolder = await ctx.db.get(args.parentFolderId);
      if (!parentFolder) {
        throw new Error("Parent folder not found");
      }
      if (!parentFolder.isFolder) {
        throw new Error("Parent must be a folder");
      }
      if (parentFolder.userId !== user._id) {
        throw new Error("Not authorized to create folder here");
      }
    }

    // Check depth limit
    const parentDepth = await getFolderDepth(ctx, args.parentFolderId ?? null);
    if (parentDepth >= MAX_FOLDER_DEPTH) {
      throw new Error(`Maximum folder depth of ${MAX_FOLDER_DEPTH} reached`);
    }

    const now = Date.now();

    const folderId = await ctx.db.insert("scripts", {
      title: args.title,
      userId: user._id,
      content: "", // Folders don't have content
      isFolder: true,
      parentFolderId: args.parentFolderId,
      lastEditedAt: now,
      createdAt: now,
    });

    return { folderId, depth: parentDepth + 1 };
  },
});

// Delete a folder and all its contents (cascade delete)
export const deleteFolder = mutation({
  args: {
    folderId: v.id("scripts"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }
    if (!folder.isFolder) {
      throw new Error("Item is not a folder");
    }
    if (folder.userId !== user._id) {
      throw new Error("Not authorized to delete this folder");
    }

    // Recursively collect all items to delete
    async function collectItemsToDelete(parentId: Id<"scripts">): Promise<Id<"scripts">[]> {
      const children = await ctx.db
        .query("scripts")
        .withIndex("by_user_and_parent", (q: any) =>
          q.eq("userId", user._id).eq("parentFolderId", parentId)
        )
        .collect();

      const allItems: Id<"scripts">[] = [parentId];

      for (const child of children) {
        if (child.isFolder) {
          const nestedItems = await collectItemsToDelete(child._id);
          allItems.push(...nestedItems);
        } else {
          allItems.push(child._id);
        }
      }

      return allItems;
    }

    const itemsToDelete = await collectItemsToDelete(args.folderId);

    // Delete all versions and comments for scripts
    for (const itemId of itemsToDelete) {
      const item = await ctx.db.get(itemId);
      if (item && !item.isFolder) {
        // Delete versions
        const versions = await ctx.db
          .query("scriptVersions")
          .withIndex("by_script", (q: any) => q.eq("scriptId", itemId))
          .collect();
        for (const version of versions) {
          await ctx.db.delete(version._id);
        }

        // Delete comments
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_script", (q: any) => q.eq("scriptId", itemId))
          .collect();
        for (const comment of comments) {
          await ctx.db.delete(comment._id);
        }
      }
    }

    // Delete all items
    for (const itemId of itemsToDelete) {
      await ctx.db.delete(itemId);
    }

    return { deletedCount: itemsToDelete.length };
  },
});

// List children of a folder (or root)
export const listChildren = query({
  args: {
    parentFolderId: v.optional(v.id("scripts")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { folders: [], scripts: [] };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return { folders: [], scripts: [] };
    }

    // Query all items with this parent
    const items = await ctx.db
      .query("scripts")
      .withIndex("by_user_and_parent", (q: any) =>
        q.eq("userId", user._id).eq("parentFolderId", args.parentFolderId)
      )
      .collect();

    // Separate folders and scripts
    const folders = items
      .filter((item) => item.isFolder)
      .sort((a, b) => a.title.localeCompare(b.title));

    const scripts = items
      .filter((item) => !item.isFolder)
      .sort((a, b) => b.lastEditedAt - a.lastEditedAt);

    return { folders, scripts };
  },
});

// Move an item to a different folder
export const moveItem = mutation({
  args: {
    itemId: v.id("scripts"),
    newParentFolderId: v.optional(v.id("scripts")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Item not found");
    }
    if (item.userId !== user._id) {
      throw new Error("Not authorized to move this item");
    }

    // Validate new parent folder if provided
    if (args.newParentFolderId) {
      const parentFolder = await ctx.db.get(args.newParentFolderId);
      if (!parentFolder) {
        throw new Error("Target folder not found");
      }
      if (!parentFolder.isFolder) {
        throw new Error("Target must be a folder");
      }
      if (parentFolder.userId !== user._id) {
        throw new Error("Not authorized to move to this folder");
      }

      // Check for circular reference (only applies to folders)
      if (item.isFolder) {
        const wouldBeCircular = await wouldCreateCircularReference(
          ctx,
          args.itemId,
          args.newParentFolderId
        );
        if (wouldBeCircular) {
          throw new Error("Cannot move a folder into itself or its children");
        }
      }

      // Check depth limit for folders
      if (item.isFolder) {
        const targetDepth = await getFolderDepth(ctx, args.newParentFolderId);
        // Need to calculate depth of item's subtree
        const itemDepth = await getSubtreeDepth(ctx, args.itemId, user._id);
        if (targetDepth + itemDepth > MAX_FOLDER_DEPTH) {
          throw new Error(`Moving this folder would exceed maximum depth of ${MAX_FOLDER_DEPTH}`);
        }
      }
    }

    await ctx.db.patch(args.itemId, {
      parentFolderId: args.newParentFolderId,
      lastEditedAt: Date.now(),
    });

    return { success: true };
  },
});

// Helper: Get the maximum depth of a folder's subtree
async function getSubtreeDepth(
  ctx: any,
  folderId: Id<"scripts">,
  userId: Id<"users">
): Promise<number> {
  const children = await ctx.db
    .query("scripts")
    .withIndex("by_user_and_parent", (q: any) =>
      q.eq("userId", userId).eq("parentFolderId", folderId)
    )
    .collect();

  const folderChildren = children.filter((c: any) => c.isFolder);
  if (folderChildren.length === 0) {
    return 1;
  }

  let maxChildDepth = 0;
  for (const child of folderChildren) {
    const childDepth = await getSubtreeDepth(ctx, child._id, userId);
    maxChildDepth = Math.max(maxChildDepth, childDepth);
  }

  return 1 + maxChildDepth;
}

// Get folder path for breadcrumbs
export const getFolderPath = query({
  args: {
    folderId: v.optional(v.id("scripts")),
  },
  handler: async (ctx, args) => {
    if (!args.folderId) {
      return [];
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    const path: Array<{ _id: Id<"scripts">; title: string }> = [];
    let currentId: Id<"scripts"> | null | undefined = args.folderId;

    while (currentId) {
      const folder: Doc<"scripts"> | null = await ctx.db.get(currentId);
      if (!folder || folder.userId !== user._id) break;

      path.unshift({ _id: folder._id, title: folder.title });
      currentId = folder.parentFolderId;

      // Safety check
      if (path.length > MAX_FOLDER_DEPTH + 1) break;
    }

    return path;
  },
});

// Get folder depth (for UI warning at level 4)
export const getFolderDepthQuery = query({
  args: {
    folderId: v.optional(v.id("scripts")),
  },
  handler: async (ctx, args) => {
    if (!args.folderId) {
      return { depth: 0, maxDepth: MAX_FOLDER_DEPTH };
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { depth: 0, maxDepth: MAX_FOLDER_DEPTH };
    }

    const depth = await getFolderDepth(ctx, args.folderId);
    return { depth, maxDepth: MAX_FOLDER_DEPTH };
  },
});

// Rename a folder
export const renameFolder = mutation({
  args: {
    folderId: v.id("scripts"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }
    if (!folder.isFolder) {
      throw new Error("Item is not a folder");
    }
    if (folder.userId !== user._id) {
      throw new Error("Not authorized to rename this folder");
    }

    await ctx.db.patch(args.folderId, {
      title: args.title,
      lastEditedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get all folders for move dialog (flat list)
export const listAllFolders = query({
  args: {
    excludeFolderId: v.optional(v.id("scripts")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    // Get all folders for this user
    const allItems = await ctx.db
      .query("scripts")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();

    const folders = allItems.filter((item) => item.isFolder);

    // If we need to exclude a folder and its children
    if (args.excludeFolderId) {
      const excludeIds = new Set<string>();

      // Recursively collect folder and all descendants
      const collectExcluded = (folderId: Id<"scripts">) => {
        excludeIds.add(folderId);
        const children = folders.filter((f) => f.parentFolderId === folderId);
        for (const child of children) {
          collectExcluded(child._id);
        }
      };

      collectExcluded(args.excludeFolderId);
      return folders.filter((f) => !excludeIds.has(f._id));
    }

    return folders;
  },
});
