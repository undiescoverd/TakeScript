import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import { DEFAULT_STAGES, KanbanStage } from "@/types/kanban";

// Fetch user's custom stages or return defaults
export function useKanbanStages() {
  const stages = useQuery(api.kanban.getOrCreateStages);
  return stages ?? DEFAULT_STAGES;
}

// Fetch all scripts and group by stageId
export function useKanbanScripts() {
  const scripts = useQuery(api.scripts.list);
  const stages = useKanbanStages();

  const groupedScripts = useMemo(() => {
    if (!scripts) return null;

    // Group scripts by stageId (treat undefined as "draft")
    const groups: Record<string, typeof scripts> = {};

    // Initialize all stage groups
    for (const stage of stages) {
      groups[stage.id] = [];
    }

    // Group scripts. A stageId that doesn't match any configured stage
    // (stage deleted/renamed, bad data) falls back to the first column so
    // the script never silently disappears from the board.
    const fallbackStageId = stages[0]?.id ?? "draft";
    for (const script of scripts) {
      const stageId = script.stageId ?? "draft";
      const targetStageId = groups[stageId] ? stageId : fallbackStageId;
      if (!groups[targetStageId]) {
        groups[targetStageId] = [];
      }
      groups[targetStageId].push(script);
    }

    // Sort each group by stageOrder
    for (const stageId in groups) {
      groups[stageId].sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0));
    }

    return groups;
  }, [scripts, stages]);

  return {
    scripts,
    groupedScripts,
    isLoading: scripts === undefined,
  };
}

// Get stage info by ID
export function useStageById(stageId: string): KanbanStage | undefined {
  const stages = useKanbanStages();
  return stages.find((s) => s.id === stageId);
}
