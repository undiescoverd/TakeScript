export interface KanbanStage {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_STAGES: KanbanStage[] = [
  { id: "draft", name: "Draft", color: "#6b7280" },
  { id: "in-progress", name: "In Progress", color: "#3b82f6" },
  { id: "review", name: "Review", color: "#f59e0b" },
  { id: "ready", name: "Ready", color: "#22c55e" },
];

export type StageId = "draft" | "in-progress" | "review" | "ready" | string;
