"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAllFolders } from "@/hooks/use-folder-tree";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Home, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: Id<"scripts">;
  itemTitle: string;
  isFolder?: boolean;
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  itemId,
  itemTitle,
  isFolder = false,
}: MoveToFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"scripts"> | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Exclude the item itself if it's a folder (can't move a folder into itself)
  const { folders, isLoading } = useAllFolders(isFolder ? itemId : undefined);

  const moveItem = useMutation(api.folders.moveItem);

  // Build a simple folder tree structure
  const rootFolders = folders.filter((f) => !f.parentFolderId);
  const getFolderChildren = (parentId: Id<"scripts">) =>
    folders.filter((f) => f.parentFolderId === parentId);

  const handleMove = async () => {
    setIsMoving(true);
    try {
      await moveItem({
        itemId,
        newParentFolderId: selectedFolderId ?? undefined,
      });
      onOpenChange(false);
      toast.success(`Moved "${itemTitle}" successfully`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to move item");
      }
    } finally {
      setIsMoving(false);
    }
  };

  const renderFolderItem = (folder: (typeof folders)[0], depth: number = 0): React.ReactNode => {
    const children = getFolderChildren(folder._id);
    const isSelected = selectedFolderId === folder._id;

    return (
      <div key={folder._id}>
        <button
          onClick={() => setSelectedFolderId(folder._id)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            isSelected && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        >
          <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{folder.title}</span>
        </button>
        {children.map((child) => renderFolderItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to Folder</DialogTitle>
          <DialogDescription>
            Select a destination folder for &quot;{itemTitle}&quot;
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px] rounded-md border p-2">
          {/* Root option */}
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              selectedFolderId === null && "bg-accent text-accent-foreground"
            )}
          >
            <Home className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span>Root (All Scripts)</span>
          </button>

          {/* Loading state */}
          {isLoading && (
            <div className="space-y-2 py-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          )}

          {/* Folders */}
          {!isLoading && rootFolders.map((folder) => renderFolderItem(folder))}

          {/* Empty state */}
          {!isLoading && folders.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No folders available. Create a folder first.
            </p>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isMoving}>
            {isMoving ? "Moving..." : "Move Here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
