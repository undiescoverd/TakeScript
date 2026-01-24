"use client";

import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Doc } from "@/convex/_generated/dataModel";
import { formatDistanceToNow } from "@/lib/utils";
import { FileText, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
  script: Doc<"scripts">;
}

export function KanbanCard({ script }: KanbanCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: script._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPreview = () => {
    try {
      const content = JSON.parse(script.content);
      const text = extractText(content);
      return text.slice(0, 60) + (text.length > 60 ? "..." : "");
    } catch {
      return "";
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

  const preview = getPreview();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative cursor-pointer rounded-lg border bg-card p-3 transition-all hover:border-primary hover:shadow-sm",
        isDragging && "opacity-50 shadow-lg"
      )}
      onClick={() => router.push(`/script/${script._id}`)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="pl-4">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <h4 className="font-medium text-sm leading-tight line-clamp-2">
            {script.title}
          </h4>
        </div>

        {/* Preview */}
        {preview && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            {preview}
          </p>
        )}

        {/* Meta */}
        <p className="mt-2 text-[10px] text-muted-foreground">
          {formatDistanceToNow(script.lastEditedAt)}
        </p>
      </div>
    </div>
  );
}
