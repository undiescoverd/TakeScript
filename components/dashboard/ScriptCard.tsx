"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./StatusBadge";

interface ScriptCardProps {
  script: Doc<"scripts">;
}

export function ScriptCard({ script }: ScriptCardProps) {
  const router = useRouter();
  const deleteScript = useMutation(api.scripts.remove);

  const getPreview = () => {
    try {
      const content = JSON.parse(script.content);
      const text = extractText(content);
      return text.slice(0, 100) + (text.length > 100 ? "..." : "");
    } catch {
      return "No content yet";
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractText = (node: any): string => {
    if (node.type === "text" && node.text) {
      return node.text;
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join(" ");
    }
    return "";
  };

  const handleDelete = async () => {
    try {
      await deleteScript({ scriptId: script._id });
      toast.success("Script deleted");
    } catch {
      toast.error("Failed to delete script");
    }
  };

  return (
    <div
      className="group relative cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:border-primary"
      onClick={() => router.push(`/script/${script._id}`)}
    >
      {/* Menu */}
      <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
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
                handleDelete();
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Icon */}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Title */}
      <h3 className="mb-1 font-medium">{script.title}</h3>

      {/* Preview */}
      <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
        {getPreview()}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Edited {formatDistanceToNow(script.lastEditedAt)}
        </p>
        <StatusBadge scriptId={script._id} stageId={script.stageId} />
      </div>
    </div>
  );
}
