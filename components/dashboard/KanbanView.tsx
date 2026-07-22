"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from "@dnd-kit/core";
import { useKanbanScripts, useKanbanStages } from "@/hooks/use-kanban";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Doc } from "@/convex/_generated/dataModel";

interface KanbanViewProps {
  onOpenSettings?: () => void;
  onAddScript?: (stageId: string) => void;
}

export function KanbanView({ onOpenSettings, onAddScript }: KanbanViewProps) {
  const stages = useKanbanStages();
  const { groupedScripts, scripts, isLoading } = useKanbanScripts();
  const reorderInStage = useMutation(api.scripts.reorderInStage);

  const [activeScript, setActiveScript] = useState<Doc<"scripts"> | null>(null);
  const [localGrouped, setLocalGrouped] = useState<Record<string, Doc<"scripts">[]> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Use local state for optimistic updates, fall back to server state
  const displayGrouped = localGrouped ?? groupedScripts;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const scriptId = event.active.id as string;
    const script = scripts?.find((s) => s._id === scriptId);
    if (script) {
      setActiveScript(script);
      // Initialize local state for optimistic updates
      if (groupedScripts) {
        setLocalGrouped({ ...groupedScripts });
      }
    }
  }, [scripts, groupedScripts]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !localGrouped) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which columns the items are in
    let activeColumn: string | null = null;
    let overColumn: string | null = null;

    for (const [stageId, stageScripts] of Object.entries(localGrouped)) {
      if (stageScripts.some((s) => s._id === activeId)) {
        activeColumn = stageId;
      }
      if (stageId === overId || stageScripts.some((s) => s._id === overId)) {
        overColumn = stageId;
      }
    }

    // If dropping on a column directly
    if (stages.some((s) => s.id === overId)) {
      overColumn = overId;
    }

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    // Move to different column at the hovered position (optimistic)
    setLocalGrouped((prev) => {
      if (!prev) return prev;
      const script = prev[activeColumn!].find((s) => s._id === activeId);
      if (!script) return prev;

      const targetScripts = prev[overColumn!] ?? [];
      const overIndex = targetScripts.findIndex((s) => s._id === overId);
      const insertIndex = overIndex >= 0 ? overIndex : targetScripts.length;
      const newTarget = [...targetScripts];
      newTarget.splice(insertIndex, 0, { ...script, stageId: overColumn! });

      return {
        ...prev,
        [activeColumn!]: prev[activeColumn!].filter((s) => s._id !== activeId),
        [overColumn!]: newTarget,
      };
    });
  }, [localGrouped, stages]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveScript(null);

    if (!over || !localGrouped) {
      setLocalGrouped(null);
      return;
    }

    const activeId = active.id as Id<"scripts">;
    const overId = over.id as string;

    // Find target column. Cross-column drags have already moved the active
    // card into the target column optimistically (handleDragOver), so also
    // check which column currently holds the active card.
    let targetColumn: string | null = null;
    if (stages.some((s) => s.id === overId)) {
      targetColumn = overId;
    } else {
      for (const [stageId, stageScripts] of Object.entries(localGrouped)) {
        if (stageScripts.some((s) => s._id === overId)) {
          targetColumn = stageId;
          break;
        }
      }
    }
    if (!targetColumn) {
      for (const [stageId, stageScripts] of Object.entries(localGrouped)) {
        if (stageScripts.some((s) => s._id === activeId)) {
          targetColumn = stageId;
          break;
        }
      }
    }

    if (!targetColumn) {
      setLocalGrouped(null);
      return;
    }

    // Find the script's original stage
    const originalScript = scripts?.find((s) => s._id === activeId);
    const originalStage = originalScript?.stageId ?? "draft";

    try {
      const columnScripts = localGrouped[targetColumn] ?? [];
      const oldIndex = columnScripts.findIndex((s) => s._id === activeId);

      if (originalStage !== targetColumn) {
        // Cross-column move: the optimistic position from handleDragOver is
        // where the card was dropped, so persist that index (not just append).
        const newIndex = oldIndex >= 0 ? oldIndex : columnScripts.length;
        await reorderInStage({
          scriptId: activeId,
          stageId: targetColumn,
          newIndex,
        });
      } else {
        // Reordering within same column
        const newIndex = columnScripts.findIndex((s) => s._id === overId);
        if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
          await reorderInStage({
            scriptId: activeId,
            stageId: targetColumn,
            newIndex,
          });
        }
      }
    } catch {
      toast.error("Failed to move script");
    }

    // Clear local state to let server state take over
    setLocalGrouped(null);
  }, [localGrouped, stages, scripts, reorderInStage]);

  const handleDragCancel = useCallback(() => {
    setActiveScript(null);
    setLocalGrouped(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kanban Board</h2>
        {onOpenSettings && (
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <Settings className="mr-2 h-4 w-4" />
            Customize Stages
          </Button>
        )}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              scripts={displayGrouped?.[stage.id] ?? []}
              onAddScript={onAddScript}
            />
          ))}
        </div>

        <DragOverlay>
          {activeScript && <KanbanCard script={activeScript} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
