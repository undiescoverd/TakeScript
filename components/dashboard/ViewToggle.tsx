"use client";

import { Grid3X3, List } from "lucide-react";
import { useFolderStore } from "@/store/folder-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ViewToggle() {
  const { viewMode, setViewMode } = useFolderStore();

  return (
    <div className="flex items-center rounded-md border bg-muted p-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 w-7 p-0", viewMode === "grid" && "bg-background shadow-sm")}
        onClick={() => setViewMode("grid")}
      >
        <Grid3X3 className="h-4 w-4" />
        <span className="sr-only">Grid view</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 w-7 p-0", viewMode === "list" && "bg-background shadow-sm")}
        onClick={() => setViewMode("list")}
      >
        <List className="h-4 w-4" />
        <span className="sr-only">List view</span>
      </Button>
    </div>
  );
}
