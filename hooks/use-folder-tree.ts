import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Hook to fetch children of a folder (or root)
 * Returns folders and scripts separately, each sorted appropriately
 */
export function useFolderChildren(parentFolderId: Id<"scripts"> | null | undefined) {
  const result = useQuery(api.folders.listChildren, {
    parentFolderId: parentFolderId ?? undefined,
  });

  return {
    folders: result?.folders ?? [],
    scripts: result?.scripts ?? [],
    isLoading: result === undefined,
  };
}

/**
 * Hook to fetch the path from root to a folder (for breadcrumbs)
 * Returns array of { _id, title } from root to current folder
 */
export function useFolderPath(folderId: Id<"scripts"> | null | undefined) {
  const path = useQuery(api.folders.getFolderPath, {
    folderId: folderId ?? undefined,
  });

  return {
    path: path ?? [],
    isLoading: path === undefined,
  };
}

/**
 * Hook to get the current depth of a folder
 * Useful for showing warnings at level 4 and blocking at level 5
 */
export function useFolderDepth(folderId: Id<"scripts"> | null | undefined) {
  const result = useQuery(api.folders.getFolderDepthQuery, {
    folderId: folderId ?? undefined,
  });

  return {
    depth: result?.depth ?? 0,
    maxDepth: result?.maxDepth ?? 5,
    isLoading: result === undefined,
    isNearLimit: (result?.depth ?? 0) >= 4,
    isAtLimit: (result?.depth ?? 0) >= 5,
  };
}

/**
 * Hook to get all folders for a move/picker dialog
 * Optionally excludes a folder and its descendants (to prevent moving into itself)
 */
export function useAllFolders(excludeFolderId?: Id<"scripts">) {
  const folders = useQuery(api.folders.listAllFolders, {
    excludeFolderId,
  });

  return {
    folders: folders ?? [],
    isLoading: folders === undefined,
  };
}
