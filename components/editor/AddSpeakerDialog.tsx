"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSpeakerStore, defaultSpeakerColors } from "@/store/speaker-store";

interface AddSpeakerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSpeakerCreated?: (speakerId: string) => void;
}

export function AddSpeakerDialog({
  open,
  onOpenChange,
  onSpeakerCreated,
}: AddSpeakerDialogProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(defaultSpeakerColors[0]);
  const [faceVisible, setFaceVisible] = useState(true);

  const addSpeaker = useSpeakerStore((state) => state.addSpeaker);
  const speakers = useSpeakerStore((state) => state.speakers);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const newSpeaker = addSpeaker({
      name: name.trim(),
      color: selectedColor,
      faceVisible,
    });

    // Reset form
    setName("");
    setSelectedColor(defaultSpeakerColors[0]);
    setFaceVisible(true);

    // Call callback with new speaker ID
    onSpeakerCreated?.(newSpeaker.id);

    // Close dialog
    onOpenChange(false);
  };

  // Auto-select next available color
  const getNextColor = () => {
    const usedColors = speakers.map((s) => s.color);
    return (
      defaultSpeakerColors.find((c) => !usedColors.includes(c)) ||
      defaultSpeakerColors[speakers.length % defaultSpeakerColors.length]
    );
  };

  // Set next color when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSelectedColor(getNextColor());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Speaker</DialogTitle>
          <DialogDescription>
            Create a new speaker to identify dialogue in your script.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name">Speaker Name</Label>
              <Input
                id="name"
                placeholder="e.g., LOREN, NICK, Actor..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {defaultSpeakerColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Face Visibility Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${faceVisible ? 'bg-primary/10' : 'bg-muted'}`}>
                  {faceVisible ? (
                    <Eye className="h-4 w-4 text-primary" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Label htmlFor="face-visible" className="cursor-pointer font-medium">
                    Face Visible
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {faceVisible ? 'Speaker is visible on camera' : 'Speaker is not visible (voiceover)'}
                  </p>
                </div>
              </div>
              <Switch
                id="face-visible"
                checked={faceVisible}
                onCheckedChange={setFaceVisible}
              />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: selectedColor }}
              >
                {faceVisible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
                <span>{name || "Speaker Name"}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Add Speaker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
