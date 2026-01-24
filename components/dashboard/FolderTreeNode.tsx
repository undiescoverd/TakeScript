"use client";

import { ChevronRight, Folder, FolderOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Doc } from "@/convex/_generated/dataModel";
import { useFolderStore } from "@/store/folder-store";
import { useFolderChildren } from "@/hooks/use-folder-tree";
import { useRouter } from "next/navigation";

interface FolderTreeNodeProps {
  folder: Doc<"scripts">;
  depth: number;
}

export function FolderTreeNode({ folder, depth }: FolderTreeNodeProps) {
  const { currentFolderId, setCurrentFolder, isExpanded, toggleFolderExpanded } = useFolderStore();

  const expanded = isExpanded(folder._id);
  const isActive = currentFolderId === folder._id;

  // Fetch children for this folder (only when expanded)
  const { folders: childFolders, scripts: childScripts } = useFolderChildren(
    expanded ? folder._id : undefined
  );

  // Check if folder has any children (folders or scripts)
  const hasChildren = childFolders.length > 0 || childScripts.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentFolder(folder._id);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolderExpanded(folder._id);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={handleChevronClick}
          className={cn(
            "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded hover:bg-muted",
            !hasChildren && "invisible"
          )}
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        </button>

        {/* Folder icon */}
        {expanded ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}

        {/* Folder name */}
        <span className="truncate">{folder.title}</span>
      </div>

      {/* Child folders and scripts */}
      {expanded && hasChildren && (
        <div>
          {/* Render child folders first */}
          {childFolders.map((childFolder) => (
            <FolderTreeNode key={childFolder._id} folder={childFolder} depth={depth + 1} />
          ))}
          {/* Render scripts after folders */}
          {childScripts.map((script) => (
            <ScriptTreeNode key={script._id} script={script} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Script item in the folder tree (leaf node, no children)
 */
interface ScriptTreeNodeProps {
  script: Doc<"scripts">;
  depth: number;
}

function ScriptTreeNode({ script, depth }: ScriptTreeNodeProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/script/${script._id}`);
  };

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground"
      )}
      style={{ paddingLeft: `${depth * 1 + 0.5}rem` }}
      onClick={handleClick}
    >
      {/* Empty space to align with folder chevrons */}
      <div className="h-4 w-4 flex-shrink-0" />

      {/* Script icon */}
      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

      {/* Script name */}
      <span className="truncate">{script.title}</span>
    </div>
  );
}
