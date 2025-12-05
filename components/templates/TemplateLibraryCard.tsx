"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreVertical, Pencil, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "@/lib/utils";
import { getTemplateIcon, getTemplateIconColor } from "@/lib/template-icons";

interface TemplateLibraryCardProps {
  templateId: Id<"templates">;
  name: string;
  description?: string;
  category?: string;
  isSystem: boolean;
  createdAt: number;
  lastUsedAt?: number;
  onEdit?: () => void;
  onUse: () => void;
}

export function TemplateLibraryCard({
  templateId,
  name,
  description,
  category,
  isSystem,
  createdAt,
  lastUsedAt,
  onEdit,
  onUse,
}: TemplateLibraryCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const removeTemplate = useMutation(api.templates.remove);

  const TemplateIcon = getTemplateIcon(name, category);
  const iconColorClass = getTemplateIconColor(category);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeTemplate({ templateId });
      toast.success("Template deleted");
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden transition-all hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <TemplateIcon className={`h-5 w-5 ${iconColorClass || "text-primary"}`} />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold leading-none">{name}</h3>
                {category && (
                  <p className="text-xs text-muted-foreground">{category}</p>
                )}
              </div>
            </div>

            {!isSystem && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <>
                      <DropdownMenuItem onClick={onEdit}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isSystem && (
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                System
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {description ? (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No description
            </p>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {lastUsedAt ? (
              <span>Used {formatDistanceToNow(lastUsedAt)}</span>
            ) : (
              <span>Created {formatDistanceToNow(createdAt)}</span>
            )}
          </div>

          <Button size="sm" onClick={onUse}>
            Use Template
          </Button>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
