"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Doc } from "@/convex/_generated/dataModel";
import { KanbanStage } from "@/types/kanban";
import { KanbanCard } from "./KanbanCard";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  stage: KanbanStage;
  scripts: Doc<"scripts">[];
  onAddScript?: (stageId: string) => void;
}

export function KanbanColumn({ stage, scripts, onAddScript }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="flex h-full w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
          <span className="text-xs text-muted-foreground">
            {scripts.length}
          </span>
        </div>
        {onAddScript && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onAddScript(stage.id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext
          items={scripts.map((s) => s._id)}
          strategy={verticalListSortingStrategy}
        >
          {scripts.map((script) => (
            <KanbanCard key={script._id} script={script} />
          ))}
        </SortableContext>

        {scripts.length === 0 && (
          <div className="flex flex-1 items-center justify-center p-4">
            <p className="text-xs text-muted-foreground">No scripts</p>
          </div>
        )}
      </div>
    </div>
  );
}
