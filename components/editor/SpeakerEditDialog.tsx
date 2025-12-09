"use client";

import { useState, useEffect } from "react";
import { Video, VideoOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useSpeakerStore } from "@/store/speaker-store";
import { Editor } from "@tiptap/react";

interface SpeakerEditDialogProps {
  editor: Editor;
  speakerId: string;
  position: number; // Document position where the label was clicked
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpeakerEditDialog({
  editor,
  speakerId,
  position,
  open,
  onOpenChange,
}: SpeakerEditDialogProps) {
  const speakers = useSpeakerStore((state) => state.speakers);
  const getSpeaker = useSpeakerStore((state) => state.getSpeaker);

  const currentSpeaker = getSpeaker(speakerId);

  const [selectedSpeakerId, setSelectedSpeakerId] = useState(speakerId);
  const [faceVisible, setFaceVisible] = useState(currentSpeaker?.faceVisible ?? true);

  // Update state when speakerId changes
  useEffect(() => {
    const speaker = getSpeaker(speakerId);
    setSelectedSpeakerId(speakerId);
    setFaceVisible(speaker?.faceVisible ?? true);
  }, [speakerId, getSpeaker]);

  const handleApply = () => {
    updateParagraphSpeaker(editor, position, selectedSpeakerId, faceVisible);
    onOpenChange(false);
  };

  const selectedSpeaker = getSpeaker(selectedSpeakerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Change Speaker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

          {/* Speaker Selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Speaker</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedSpeakerId}
              onChange={(e) => {
                setSelectedSpeakerId(e.target.value);
                const speaker = getSpeaker(e.target.value);
                if (speaker) {
                  setFaceVisible(speaker.faceVisible);
                }
              }}
            >
              {speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  {speaker.name}
                </option>
              ))}
            </select>

            {/* Speaker Preview - shows name with colored left border */}
            {selectedSpeaker && (
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-1 h-6 rounded-full"
                  style={{ backgroundColor: selectedSpeaker.color }}
                />
                <span
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{ color: selectedSpeaker.color }}
                >
                  {selectedSpeaker.name}
                </span>
                {!faceVisible && (
                  <span className="text-xs text-muted-foreground italic">(VO)</span>
                )}
              </div>
            )}
          </div>

          {/* On Camera / Voiceover Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-1.5 ${faceVisible ? 'bg-primary/10' : 'bg-muted'}`}>
                {faceVisible ? (
                  <Video className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <VideoOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div>
                <Label htmlFor="face-visible-edit" className="cursor-pointer font-medium text-sm">
                  On Camera
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {faceVisible ? 'Speaker is visible' : 'Voiceover only'}
                </p>
              </div>
            </div>
            <Switch
              id="face-visible-edit"
              checked={faceVisible}
              onCheckedChange={setFaceVisible}
            />
          </div>

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full">
            Apply Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Update the speaker for the paragraph at the given position.
 * This is a safer approach that works at the paragraph level rather than
 * trying to find exact mark boundaries.
 */
function updateParagraphSpeaker(
  editor: Editor,
  position: number,
  newSpeakerId: string,
  faceVisible: boolean
) {
  try {
    const { doc } = editor.state;

    // Resolve position and find the parent paragraph
    const $pos = doc.resolve(position);

    // Find the paragraph node that contains this position
    let paragraphPos: number | null = null;
    let paragraphNode: any = null;

    for (let d = $pos.depth; d >= 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === "paragraph") {
        paragraphPos = $pos.before(d);
        paragraphNode = node;
        break;
      }
    }

    if (paragraphPos === null || !paragraphNode) {
      console.warn("[SpeakerEditDialog] Could not find paragraph at position", position);
      return;
    }

    // Calculate the range of the paragraph's content
    const from = paragraphPos + 1; // Start of paragraph content (after opening tag)
    const to = paragraphPos + paragraphNode.nodeSize - 1; // End of paragraph content (before closing tag)

    if (from >= to) {
      console.warn("[SpeakerEditDialog] Empty paragraph, nothing to update");
      return;
    }

    // Use editor chain for safer transaction handling
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .unsetMark("speaker")
      .setMark("speaker", { speakerId: newSpeakerId, faceVisible })
      .run();

  } catch (error) {
    console.error("[SpeakerEditDialog] Error updating speaker:", error);
  }
}
