"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2, Plus } from "lucide-react";
import { useSpeakerStore } from "@/store/speaker-store";
import { Button } from "@/components/ui/button";
import { AddSpeakerDialog } from "./AddSpeakerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function SpeakerLegend() {
  const speakers = useSpeakerStore((state) => state.speakers);
  const deleteSpeaker = useSpeakerStore((state) => state.deleteSpeaker);
  const updateSpeaker = useSpeakerStore((state) => state.updateSpeaker);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [speakerToDelete, setSpeakerToDelete] = useState<string | null>(null);

  const handleToggleFaceVisible = (speakerId: string, currentValue: boolean) => {
    updateSpeaker(speakerId, { faceVisible: !currentValue });
    toast.success(
      `Face visibility ${!currentValue ? "enabled" : "disabled"} for speaker`
    );
  };

  const handleDeleteSpeaker = (speakerId: string) => {
    deleteSpeaker(speakerId);
    setSpeakerToDelete(null);
    toast.success("Speaker deleted");
  };

  if (speakers.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Speakers</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Speaker
          </Button>
        </div>

        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No speakers yet. Create your first speaker to start attributing dialogue.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Speaker
          </Button>
        </div>

        <AddSpeakerDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Speakers</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {speakers.map((speaker, index) => (
          <div
            key={speaker.id}
            className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
          >
            {/* Color indicator with border */}
            <div className="relative shrink-0">
              <div
                className="h-10 w-1 rounded-full"
                style={{ backgroundColor: speaker.color }}
              />
            </div>

            {/* Speaker info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {speaker.name}
                </span>
                {/* Show keyboard shortcut for first 4 speakers */}
                {index < 4 && (
                  <div className="hidden sm:flex items-center gap-1">
                    <kbd className="h-5 select-none inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                      <span className="text-xs">⌘</span>{index + 1}
                    </kbd>
                    <span className="text-[9px] text-muted-foreground/70">
                      toggle/swap
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {speaker.faceVisible ? (
                  <Eye className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">
                  {speaker.faceVisible ? "Face visible" : "Face not visible"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  handleToggleFaceVisible(speaker.id, speaker.faceVisible)
                }
                title={
                  speaker.faceVisible
                    ? "Mark as not visible"
                    : "Mark as visible"
                }
              >
                {speaker.faceVisible ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => setSpeakerToDelete(speaker.id)}
                title="Delete speaker"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Keyboard shortcuts help */}
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1.5">
        <div className="font-medium text-foreground mb-2">Keyboard Shortcuts</div>
        <div className="flex items-center gap-2">
          <kbd className="h-5 inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            <span className="text-xs">⌘</span>1-4
          </kbd>
          <span>Add speaker, or toggle/swap if already assigned</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="h-5 inline-flex items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            <span className="text-xs">⌘</span>`
          </kbd>
          <span>Remove speaker from selection</span>
        </div>
      </div>

      <AddSpeakerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={speakerToDelete !== null}
        onOpenChange={(open) => !open && setSpeakerToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Speaker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the speaker from your list. Any text attributed to
              this speaker will lose its speaker assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => speakerToDelete && handleDeleteSpeaker(speakerToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
