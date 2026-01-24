"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useFolderStore } from "@/store/folder-store";
import { useFolderDepth } from "@/hooks/use-folder-tree";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FolderPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function NewFolderDialog() {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { currentFolderId, setCurrentFolder, setFolderExpanded } = useFolderStore();
  const { depth, maxDepth, isNearLimit, isAtLimit } = useFolderDepth(currentFolderId);

  const createFolder = useMutation(api.folders.createFolder);

  const handleCreate = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    if (isAtLimit) {
      toast.error(`Maximum folder depth of ${maxDepth} reached`);
      return;
    }

    setIsCreating(true);
    try {
      const result = await createFolder({
        title: folderName.trim(),
        parentFolderId: currentFolderId ?? undefined,
      });

      // Set the newly created folder as active
      setCurrentFolder(result.folderId);

      // Expand parent folder if we created a nested folder
      if (currentFolderId) {
        setFolderExpanded(currentFolderId, true);
      }

      // Expand the new folder in sidebar
      setFolderExpanded(result.folderId, true);

      setOpen(false);
      setFolderName("");
      toast.success("Folder created");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to create folder");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setFolderName("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FolderPlus className="mr-2 h-4 w-4" />
          New Folder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            {currentFolderId
              ? "Create a new folder inside the current folder"
              : "Create a new folder at the root level"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Depth warning */}
          {isNearLimit && !isAtLimit && (
            <Alert
              variant="default"
              className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
            >
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                You&apos;re approaching the maximum folder depth ({depth}/{maxDepth}). Consider
                organizing with fewer nested folders.
              </AlertDescription>
            </Alert>
          )}

          {isAtLimit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Maximum folder depth of {maxDepth} reached. You cannot create folders at this level.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="Enter folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isAtLimit) {
                  handleCreate();
                }
              }}
              disabled={isAtLimit}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !folderName.trim() || isAtLimit}>
            {isCreating ? "Creating..." : "Create Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
