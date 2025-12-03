"use client";

import { useEditorStore } from "@/store/editor-store";
import { Button } from "@/components/ui/button";
import { Eye, Edit3 } from "lucide-react";

export function ModeToggle() {
  const { mode, toggleMode } = useEditorStore();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleMode}
      className="gap-2"
    >
      {mode === "editing" ? (
        <>
          <Edit3 className="h-4 w-4" />
          Editing
        </>
      ) : (
        <>
          <Eye className="h-4 w-4" />
          Recording
        </>
      )}
    </Button>
  );
}
