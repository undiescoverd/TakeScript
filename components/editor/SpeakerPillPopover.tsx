"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useSpeakerStore, Speaker } from "@/store/speaker-store";
import { Editor } from "@tiptap/react";

interface SpeakerPillPopoverProps {
  editor: Editor;
  speakerId: string;
  position: number; // Document position where the speaker mark starts
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

export function SpeakerPillPopover({
  editor,
  speakerId,
  position,
  open,
  onOpenChange,
}: SpeakerPillPopoverProps) {
  const speakers = useSpeakerStore((state) => state.speakers);
  const getSpeaker = useSpeakerStore((state) => state.getSpeaker);

  const currentSpeaker = getSpeaker(speakerId);

  const [selectedSpeakerId, setSelectedSpeakerId] = useState(speakerId);
  const [faceVisible, setFaceVisible] = useState(currentSpeaker?.faceVisible ?? true);
  const [applyScope, setApplyScope] = useState<"single" | "consecutive">("single");
  const [consecutiveCount, setConsecutiveCount] = useState(0);

  // Update state when speakerId changes
  useEffect(() => {
    const speaker = getSpeaker(speakerId);
    setSelectedSpeakerId(speakerId);
    setFaceVisible(speaker?.faceVisible ?? true);
  }, [speakerId, getSpeaker]);

  // Calculate consecutive count when popover opens
  useEffect(() => {
    if (open) {
      const count = countConsecutiveSpeakerSelections(editor, position, speakerId);
      setConsecutiveCount(count);
    }
  }, [open, editor, position, speakerId]);

  const handleApply = () => {
    if (applyScope === "single") {
      updateSingleSelection(editor, position, selectedSpeakerId, faceVisible);
    } else {
      updateConsecutiveSelections(editor, position, speakerId, selectedSpeakerId, faceVisible);
    }
    onOpenChange(false);
  };

  const selectedSpeaker = getSpeaker(selectedSpeakerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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

          {/* Speaker Preview */}
          {selectedSpeaker && (
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: selectedSpeaker.color }}
            >
              {faceVisible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              <span>{selectedSpeaker.name}</span>
            </div>
          )}
        </div>

        {/* Face Visibility Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-1.5 ${faceVisible ? 'bg-primary/10' : 'bg-muted'}`}>
              {faceVisible ? (
                <Eye className="h-3.5 w-3.5 text-primary" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div>
              <Label htmlFor="face-visible-edit" className="cursor-pointer font-medium text-sm">
                Face Visible
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {faceVisible ? 'On camera' : 'Voiceover'}
              </p>
            </div>
          </div>
          <Switch
            id="face-visible-edit"
            checked={faceVisible}
            onCheckedChange={setFaceVisible}
          />
        </div>

        {/* Apply Scope */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Apply to</Label>
          <RadioGroup value={applyScope} onValueChange={(value) => setApplyScope(value as "single" | "consecutive")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="single" id="single" />
              <Label htmlFor="single" className="cursor-pointer font-normal text-sm">
                This selection only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="consecutive" id="consecutive" />
              <Label htmlFor="consecutive" className="cursor-pointer font-normal text-sm">
                All {consecutiveCount} consecutive with {currentSpeaker?.name}
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Apply Button */}
        <button
          onClick={handleApply}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Apply Changes
        </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Count how many consecutive speaker selections exist from the given position
 */
function countConsecutiveSpeakerSelections(
  editor: Editor,
  startPos: number,
  speakerId: string
): number {
  let count = 0;
  const { doc } = editor.state;

  // Find the current speaker mark range
  const $pos = doc.resolve(startPos);
  const marks = $pos.marks();
  const speakerMark = marks.find((m) => m.type.name === "speaker" && m.attrs.speakerId === speakerId);

  if (!speakerMark) return 1;

  count = 1; // Count the current selection

  // Scan forward for consecutive speaker marks
  let currentPos = startPos;
  while (currentPos < doc.content.size) {
    const $currentPos = doc.resolve(currentPos);
    const currentMarks = $currentPos.marks();
    const currentSpeakerMark = currentMarks.find(
      (m) => m.type.name === "speaker" && m.attrs.speakerId === speakerId
    );

    if (!currentSpeakerMark) {
      // Check if we've moved to a new speaker or no speaker
      const hasAnySpeaker = currentMarks.some((m) => m.type.name === "speaker");
      if (hasAnySpeaker) break; // Different speaker found

      // Continue if it's just unmarked text (like whitespace)
      currentPos++;
      continue;
    }

    // Find the end of this speaker mark
    let endPos = currentPos;
    while (endPos < doc.content.size) {
      const $endPos = doc.resolve(endPos);
      const endMarks = $endPos.marks();
      const endSpeakerMark = endMarks.find(
        (m) => m.type.name === "speaker" && m.attrs.speakerId === speakerId
      );
      if (!endSpeakerMark) break;
      endPos++;
    }

    count++;
    currentPos = endPos;
  }

  return count;
}

/**
 * Update a single speaker selection at the given position
 */
function updateSingleSelection(
  editor: Editor,
  position: number,
  newSpeakerId: string,
  faceVisible: boolean
) {
  const { doc, tr } = editor.state;
  const $pos = doc.resolve(position);

  // Find the speaker mark at this position
  const marks = $pos.marks();
  const speakerMark = marks.find((m) => m.type.name === "speaker");

  if (!speakerMark) return;

  // Find the range of the current speaker mark
  let from = position;
  let to = position;

  // Scan backward to find start
  while (from > 0) {
    const $from = doc.resolve(from - 1);
    const fromMarks = $from.marks();
    const fromSpeakerMark = fromMarks.find(
      (m) => m.type.name === "speaker" && m.attrs.speakerId === speakerMark.attrs.speakerId
    );
    if (!fromSpeakerMark) break;
    from--;
  }

  // Scan forward to find end
  while (to < doc.content.size) {
    const $to = doc.resolve(to);
    const toMarks = $to.marks();
    const toSpeakerMark = toMarks.find(
      (m) => m.type.name === "speaker" && m.attrs.speakerId === speakerMark.attrs.speakerId
    );
    if (!toSpeakerMark) break;
    to++;
  }

  // Remove old speaker mark and add new one
  const speakerMarkType = editor.schema.marks.speaker;
  editor.view.dispatch(
    tr
      .removeMark(from, to, speakerMarkType)
      .addMark(from, to, speakerMarkType.create({ speakerId: newSpeakerId, faceVisible }))
  );
}

/**
 * Update all consecutive speaker selections with the same speakerId
 */
function updateConsecutiveSelections(
  editor: Editor,
  startPos: number,
  oldSpeakerId: string,
  newSpeakerId: string,
  faceVisible: boolean
) {
  const { doc, tr } = editor.state;
  const speakerMarkType = editor.schema.marks.speaker;

  // Find all ranges with the old speaker ID
  const ranges: { from: number; to: number }[] = [];

  let currentPos = 0;
  while (currentPos < doc.content.size) {
    const $pos = doc.resolve(currentPos);
    const marks = $pos.marks();
    const speakerMark = marks.find(
      (m) => m.type.name === "speaker" && m.attrs.speakerId === oldSpeakerId
    );

    if (speakerMark) {
      // Found a speaker mark, find its full range
      let from = currentPos;
      let to = currentPos;

      // Scan backward to find start
      while (from > 0) {
        const $from = doc.resolve(from - 1);
        const fromMarks = $from.marks();
        const fromSpeakerMark = fromMarks.find(
          (m) => m.type.name === "speaker" && m.attrs.speakerId === oldSpeakerId
        );
        if (!fromSpeakerMark) break;
        from--;
      }

      // Scan forward to find end
      while (to < doc.content.size) {
        const $to = doc.resolve(to);
        const toMarks = $to.marks();
        const toSpeakerMark = toMarks.find(
          (m) => m.type.name === "speaker" && m.attrs.speakerId === oldSpeakerId
        );
        if (!toSpeakerMark) break;
        to++;
      }

      ranges.push({ from, to });
      currentPos = to; // Jump to end of this range
    } else {
      currentPos++;
    }
  }

  // Update all ranges
  let updatedTr = tr;
  for (const range of ranges) {
    updatedTr = updatedTr
      .removeMark(range.from, range.to, speakerMarkType)
      .addMark(range.from, range.to, speakerMarkType.create({ speakerId: newSpeakerId, faceVisible }));
  }

  editor.view.dispatch(updatedTr);
}
