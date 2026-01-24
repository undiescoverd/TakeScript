"use client";

import { LayoutGrid, List, Columns } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStore, ViewMode } from "@/store/dashboard-store";
import { cn } from "@/lib/utils";

const views: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: "grid", icon: LayoutGrid, label: "Grid view" },
  { mode: "list", icon: List, label: "List view" },
  { mode: "kanban", icon: Columns, label: "Kanban view" },
];

export function ViewToggle() {
  const { viewMode, setViewMode } = useDashboardStore();

  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-1">
      {views.map(({ mode, icon: Icon, label }) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          onClick={() => setViewMode(mode)}
          aria-label={label}
          className={cn(
            "h-7 w-7 p-0",
            viewMode === mode && "bg-background shadow-sm"
          )}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}
