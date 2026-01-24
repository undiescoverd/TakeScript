"use client";

import { Doc, Id } from "@/convex/_generated/dataModel";
import { useFolderStore } from "@/store/folder-store";
import { useFolderChildren } from "@/hooks/use-folder-tree";
import { FolderBreadcrumbs } from "./FolderBreadcrumbs";
import { ViewToggle } from "./ViewToggle";
import { ListView } from "./ListView";
import { FolderCard } from "./FolderCard";
import { ScriptCard } from "./ScriptCard";
import { Folder } from "lucide-react";

interface FolderMainPanelProps {
  onMoveScript?: (scriptId: Id<"scripts">) => void;
}

export function FolderMainPanel({ onMoveScript }: FolderMainPanelProps) {
  const { currentFolderId, viewMode } = useFolderStore();
  const { folders, scripts, isLoading } = useFolderChildren(currentFolderId);

  return (
    <div className="flex flex-1 flex-col">
      {/* Header with breadcrumbs and view toggle */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <FolderBreadcrumbs />
        <ViewToggle />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <LoadingState viewMode={viewMode} />
        ) : viewMode === "list" ? (
          <ListView folders={folders} scripts={scripts} onMoveScript={onMoveScript} />
        ) : (
          <GridView folders={folders} scripts={scripts} />
        )}
      </div>
    </div>
  );
}

function LoadingState({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function GridView({ folders, scripts }: { folders: Doc<"scripts">[]; scripts: Doc<"scripts">[] }) {
  if (folders.length === 0 && scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Folder className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-medium">This folder is empty</h3>
        <p className="text-muted-foreground">Create a script or folder to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Folders first */}
      {folders.map((folder) => (
        <FolderCard key={folder._id} folder={folder} />
      ))}

      {/* Then scripts */}
      {scripts.map((script) => (
        <ScriptCard key={script._id} script={script} />
      ))}
    </div>
  );
}
