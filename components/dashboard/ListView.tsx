"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "@/lib/utils";
import { useFolderStore } from "@/store/folder-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Folder, FileText, MoreVertical, Trash2, FolderInput } from "lucide-react";
import { toast } from "sonner";

interface ListViewProps {
  folders: Doc<"scripts">[];
  scripts: Doc<"scripts">[];
  onMoveScript?: (scriptId: Id<"scripts">) => void;
}

export function ListView({ folders, scripts, onMoveScript }: ListViewProps) {
  const router = useRouter();
  const { setCurrentFolder, setFolderExpanded } = useFolderStore();
  const deleteScript = useMutation(api.scripts.remove);
  const deleteFolder = useMutation(api.folders.deleteFolder);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: Id<"scripts">;
    title: string;
    type: "folder" | "script";
  } | null>(null);

  const handleFolderClick = (folder: Doc<"scripts">) => {
    setCurrentFolder(folder._id);
    setFolderExpanded(folder._id, true);
  };

  const handleScriptClick = (script: Doc<"scripts">) => {
    router.push(`/script/${script._id}`);
  };

  const openDeleteDialog = (id: Id<"scripts">, title: string, type: "folder" | "script") => {
    setItemToDelete({ id, title, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      if (itemToDelete.type === "folder") {
        const result = await deleteFolder({ folderId: itemToDelete.id });
        toast.success(`Deleted folder and ${result.deletedCount - 1} items`);
      } else {
        await deleteScript({ scriptId: itemToDelete.id });
        toast.success("Script deleted");
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch {
      toast.error(
        itemToDelete.type === "folder" ? "Failed to delete folder" : "Failed to delete script"
      );
    } finally {
      setIsDeleting(false);
    }
  };

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
    <div className="rounded-lg border">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Modified</th>
            <th className="w-12 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {/* Folders first */}
          {folders.map((folder) => (
            <ContextMenu key={folder._id}>
              <ContextMenuTrigger asChild>
                <tr
                  className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                  onClick={() => handleFolderClick(folder)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{folder.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Folder</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDistanceToNow(folder.lastEditedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(folder._id, folder.title, "folder");
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => openDeleteDialog(folder._id, folder.title, "folder")}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          {/* Scripts */}
          {scripts.map((script) => (
            <ContextMenu key={script._id}>
              <ContextMenuTrigger asChild>
                <tr
                  className="cursor-pointer border-b transition-colors hover:bg-muted/50 last:border-b-0"
                  onClick={() => handleScriptClick(script)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{script.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Script</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDistanceToNow(script.lastEditedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onMoveScript && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onMoveScript(script._id);
                            }}
                          >
                            <FolderInput className="mr-2 h-4 w-4" />
                            Move to folder
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(script._id, script.title, "script");
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {onMoveScript && (
                  <>
                    <ContextMenuItem onClick={() => onMoveScript(script._id)}>
                      <FolderInput className="mr-2 h-4 w-4" />
                      Move to folder
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                  </>
                )}
                <ContextMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => openDeleteDialog(script._id, script.title, "script")}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </tbody>
      </table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {itemToDelete?.type === "folder" ? "Folder" : "Script"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{itemToDelete?.title}&quot;?
              {itemToDelete?.type === "folder"
                ? " This will permanently delete this folder and all its contents."
                : " This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
