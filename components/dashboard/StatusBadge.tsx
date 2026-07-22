"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useKanbanStages } from "@/hooks/use-kanban";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface StatusBadgeProps {
  scriptId: Id<"scripts">;
  stageId: string | undefined;
}

export function StatusBadge({ scriptId, stageId }: StatusBadgeProps) {
  const stages = useKanbanStages();
  const updateStage = useMutation(api.scripts.updateStage);

  // Default to "draft" if no stageId
  const currentStageId = stageId ?? "draft";
  const currentStage = stages.find((s) => s.id === currentStageId) ?? stages[0];

  const handleStageChange = async (newStageId: string) => {
    if (newStageId === currentStageId) return;

    try {
      await updateStage({ scriptId, stageId: newStageId });
    } catch {
      toast.error("Failed to update status");
    }
  };

  // No stages configured — nothing sensible to render or select
  if (!currentStage) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 focus:outline-none"
        style={{
          backgroundColor: `${currentStage.color}20`,
          color: currentStage.color,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: currentStage.color }}
        />
        {currentStage.name}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {stages.map((stage) => (
          <DropdownMenuItem
            key={stage.id}
            onClick={() => handleStageChange(stage.id)}
            className="gap-2"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            {stage.name}
            {stage.id === currentStageId && (
              <span className="ml-auto text-xs text-muted-foreground">
                Current
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
