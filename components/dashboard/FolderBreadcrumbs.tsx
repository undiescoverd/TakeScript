"use client";

import { ChevronRight, Home } from "lucide-react";
import { useFolderStore } from "@/store/folder-store";
import { useFolderPath } from "@/hooks/use-folder-tree";
import { Id } from "@/convex/_generated/dataModel";

export function FolderBreadcrumbs() {
  const { currentFolderId, setCurrentFolder } = useFolderStore();
  const { path, isLoading } = useFolderPath(currentFolderId);

  return (
    <nav className="flex items-center gap-1 text-sm">
      {/* Home/Root */}
      <button
        onClick={() => setCurrentFolder(null)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Home className="h-4 w-4" />
        <span>All Scripts</span>
      </button>

      {/* Path segments */}
      {!isLoading &&
        path.map((segment, index) => (
          <div key={segment._id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              onClick={() => setCurrentFolder(segment._id as Id<"scripts">)}
              className={
                index === path.length - 1
                  ? "font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }
            >
              {segment.title}
            </button>
          </div>
        ))}

      {/* Loading placeholder */}
      {isLoading && currentFolderId && (
        <>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </>
      )}
    </nav>
  );
}
