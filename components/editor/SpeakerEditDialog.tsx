"use client";

import { useState, useCallback, useEffect } from "react";
import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSpeakerStore, Speaker } from "@/store/speaker-store";
import { CameraMode, CameraModeNullable, cameraModeLabels } from "@/lib/tiptap/speaker-mark";

interface SpeakerEditDialogProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  paragraphPos: number | null;
  currentSpeakerId: string | null;
  currentCameraMode: CameraModeNullable;
}

export function SpeakerEditDialog({
  editor,
  isOpen,
  onClose,
  paragraphPos,
  currentSpeakerId,
  currentCameraMode,
}: SpeakerEditDialogProps) {
  const { speakers, getSpeakerById } = useSpeakerStore();

  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const [selectedCameraMode, setSelectedCameraMode] = useState<CameraModeNullable>(null);

  // Initialize form values when dialog opens
  useEffect(() => {
    if (isOpen && currentSpeakerId) {
      setSelectedSpeakerId(currentSpeakerId);
      setSelectedCameraMode(currentCameraMode);
    }
  }, [isOpen, currentSpeakerId, currentCameraMode]);

  const handleSave = useCallback(() => {
    if (!editor || paragraphPos === null) return;

    const speaker = getSpeakerById(selectedSpeakerId);
    if (!speaker) {
      toast.error("Please select a speaker");
      return;
    }

    // Find the paragraph at the given position
    const { doc } = editor.state;
    const $pos = doc.resolve(paragraphPos);

    // Get the paragraph node
    const node = doc.nodeAt(paragraphPos);
    if (!node || node.type.name !== "paragraph") {
      toast.error("Could not find paragraph");
      return;
    }

    // Calculate the range of the paragraph content
    const from = paragraphPos + 1; // After the paragraph opening
    const to = paragraphPos + node.nodeSize - 1; // Before the paragraph closing

    // Apply the speaker mark to the entire paragraph
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .setSpeaker({
        speakerId: selectedSpeakerId,
        cameraMode: selectedCameraMode,
      })
      .run();

    onClose();
    toast.success(`Updated to ${speaker.name}`);
  }, [editor, paragraphPos, selectedSpeakerId, selectedCameraMode, getSpeakerById, onClose]);

  const handleRemove = useCallback(() => {
    if (!editor || paragraphPos === null) return;

    // Find the paragraph at the given position
    const { doc } = editor.state;
    const node = doc.nodeAt(paragraphPos);
    if (!node || node.type.name !== "paragraph") {
      toast.error("Could not find paragraph");
      return;
    }

    // Calculate the range of the paragraph content
    const from = paragraphPos + 1;
    const to = paragraphPos + node.nodeSize - 1;

    // Remove the speaker mark from the paragraph
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .unsetSpeaker()
      .run();

    onClose();
    toast.success("Removed speaker attribution");
  }, [editor, paragraphPos, onClose]);

  const currentSpeaker = currentSpeakerId ? getSpeakerById(currentSpeakerId) : null;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Speaker Attribution</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Speaker Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Speaker</label>
            {speakers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No speakers available. Add speakers in the Speaker Legend panel.
              </div>
            ) : (
              <Select
                value={selectedSpeakerId}
                onValueChange={setSelectedSpeakerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a speaker..." />
                </SelectTrigger>
                <SelectContent>
                  {speakers.map((speaker) => (
                    <SelectItem key={speaker.id} value={speaker.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: speaker.color }}
                        />
                        <span>{speaker.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Camera Mode Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Camera View (Optional)</label>
            <div className="flex gap-2">
              {/* None option */}
              <Button
                type="button"
                variant={selectedCameraMode === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCameraMode(null)}
                className="flex-1"
              >
                None
              </Button>
              {(["full", "corner", "voiceover"] as CameraMode[]).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={selectedCameraMode === mode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCameraMode(mode)}
                  className="flex-1"
                >
                  {cameraModeLabels[mode]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove Speaker
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={speakers.length === 0}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage speaker edit dialog state
export function useSpeakerEditDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [paragraphPos, setParagraphPos] = useState<number | null>(null);
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null);
  const [currentCameraMode, setCurrentCameraMode] = useState<CameraModeNullable>(null);

  const openDialog = useCallback((
    pos: number,
    speakerId: string,
    cameraMode: CameraModeNullable
  ) => {
    setParagraphPos(pos);
    setCurrentSpeakerId(speakerId);
    setCurrentCameraMode(cameraMode);
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setParagraphPos(null);
    setCurrentSpeakerId(null);
    setCurrentCameraMode(null);
  }, []);

  return {
    isOpen,
    paragraphPos,
    currentSpeakerId,
    currentCameraMode,
    openDialog,
    closeDialog,
  };
}
