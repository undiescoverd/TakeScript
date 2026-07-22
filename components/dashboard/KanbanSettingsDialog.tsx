"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useKanbanStages } from "@/hooks/use-kanban";
import { KanbanStage, DEFAULT_STAGES } from "@/types/kanban";
import { RotateCcw } from "lucide-react";

// Preset colors for easy selection
const PRESET_COLORS = [
  "#6b7280", // Gray
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#84cc16", // Lime
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#ec4899", // Pink
];

interface KanbanSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KanbanSettingsDialog({
  open,
  onOpenChange,
}: KanbanSettingsDialogProps) {
  const currentStages = useKanbanStages();
  const updateStages = useMutation(api.kanban.updateStages);
  const resetToDefaults = useMutation(api.kanban.resetToDefaults);

  const [stages, setStages] = useState<KanbanStage[]>(currentStages);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Reset the dirty flag each time the dialog opens
  useEffect(() => {
    if (open) {
      setIsDirty(false);
    }
  }, [open]);

  // Sync local state from the server while the dialog is open, but stop as
  // soon as the user edits something so a query refresh can't wipe their
  // in-progress changes.
  useEffect(() => {
    if (open && !isDirty) {
      setStages(currentStages);
    }
  }, [open, isDirty, currentStages]);

  const handleNameChange = (id: string, name: string) => {
    setIsDirty(true);
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  };

  const handleColorChange = (id: string, color: string) => {
    setIsDirty(true);
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, color } : s))
    );
  };

  const handleSave = async () => {
    // Validate names are not empty
    if (stages.some((s) => !s.name.trim())) {
      toast.error("Stage names cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await updateStages({ stages });
      toast.success("Stages updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update stages");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await resetToDefaults();
      setStages(DEFAULT_STAGES);
      setIsDirty(false);
      toast.success("Stages reset to defaults");
    } catch {
      toast.error("Failed to reset stages");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize Kanban Stages</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {stages.map((stage) => (
            <div key={stage.id} className="space-y-2">
              <Label htmlFor={`stage-${stage.id}`} className="text-sm">
                {stage.id.charAt(0).toUpperCase() + stage.id.slice(1).replace("-", " ")} Stage
              </Label>
              <div className="flex items-center gap-2">
                {/* Color picker */}
                <div className="relative">
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => handleColorChange(stage.id, e.target.value)}
                    className="absolute inset-0 h-9 w-9 cursor-pointer opacity-0"
                  />
                  <div
                    className="h-9 w-9 rounded-md border cursor-pointer"
                    style={{ backgroundColor: stage.color }}
                  />
                </div>
                {/* Name input */}
                <Input
                  id={`stage-${stage.id}`}
                  value={stage.name}
                  onChange={(e) => handleNameChange(stage.id, e.target.value)}
                  className="flex-1"
                  placeholder="Stage name"
                />
              </div>
              {/* Preset colors */}
              <div className="flex gap-1 pl-11">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorChange(stage.id, color)}
                    className="h-5 w-5 rounded-sm border transition-transform hover:scale-110"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2 sm:ml-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
