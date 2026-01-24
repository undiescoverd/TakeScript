"use client";

import { Home, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFolderStore } from "@/store/folder-store";
import { useFolderChildren } from "@/hooks/use-folder-tree";
import { FolderTreeNode } from "./FolderTreeNode";
import { Button } from "@/components/ui/button";

export function FolderSidebar() {
  const { currentFolderId, setCurrentFolder, folderSidebarOpen, toggleFolderSidebar } =
    useFolderStore();

  // Fetch root folders
  const { folders: rootFolders, isLoading } = useFolderChildren(null);

  if (!folderSidebarOpen) {
    return (
      <div className="flex h-full flex-col border-r bg-card p-2">
        <Button variant="ghost" size="icon" onClick={toggleFolderSidebar} className="h-8 w-8">
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-60 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Folders</span>
        <Button variant="ghost" size="icon" onClick={toggleFolderSidebar} className="h-6 w-6">
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* All Scripts (Root) */}
        <div
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            currentFolderId === null && "bg-accent text-accent-foreground"
          )}
          onClick={() => setCurrentFolder(null)}
        >
          <Home className="h-4 w-4 text-muted-foreground" />
          <span>All Scripts</span>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="mt-2 space-y-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-7 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        )}

        {/* Root folders */}
        {!isLoading && rootFolders.length > 0 && (
          <div className="mt-2">
            {rootFolders.map((folder) => (
              <FolderTreeNode key={folder._id} folder={folder} depth={0} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && rootFolders.length === 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">No folders yet</p>
        )}
      </div>
    </div>
  );
}
