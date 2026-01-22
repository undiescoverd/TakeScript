"use client";

import { useState, useCallback, useEffect } from "react";
import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Users,
  X,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useSpeakerStore,
  Speaker,
  defaultSpeakerColors,
  getNextSpeakerColor,
  generateSpeakerId,
} from "@/store/speaker-store";
import { CameraMode, cameraModeLabels } from "@/lib/tiptap/speaker-mark";

interface SpeakerLegendProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  onSpeakersChange: (speakers: Speaker[]) => void;
}

export function SpeakerLegend({
  editor,
  isOpen,
  onClose,
  onSpeakersChange,
}: SpeakerLegendProps) {
  const { speakers, addSpeaker, updateSpeaker, removeSpeaker } = useSpeakerStore();

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [deletingSpeaker, setDeletingSpeaker] = useState<Speaker | null>(null);

  // Form states
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [newSpeakerColor, setNewSpeakerColor] = useState(() => getNextSpeakerColor(speakers));
  // For editing only - add dialog uses default "full"
  const [editSpeakerVisibility, setEditSpeakerVisibility] = useState<CameraMode>("full");

  const handleAddSpeaker = useCallback(() => {
    if (!newSpeakerName.trim()) {
      toast.error("Please enter a speaker name");
      return;
    }
    if (speakers.length >= 4) {
      toast.error("Maximum of 4 speakers allowed");
      return;
    }

    const speaker: Speaker = {
      id: generateSpeakerId(),
      name: newSpeakerName.trim(),
      color: newSpeakerColor,
      defaultVisibility: "full", // Default to full, camera mode chosen when assigning
    };

    addSpeaker(speaker);
    onSpeakersChange([...speakers, speaker]);

    // Reset form
    setNewSpeakerName("");
    setNewSpeakerColor(getNextSpeakerColor([...speakers, speaker]));
    setIsAddDialogOpen(false);

    toast.success(`Added speaker: ${speaker.name}`);
  }, [newSpeakerName, newSpeakerColor, speakers, addSpeaker, onSpeakersChange]);

  const handleEditSpeaker = useCallback(() => {
    if (!editingSpeaker) return;
    if (!newSpeakerName.trim()) {
      toast.error("Please enter a speaker name");
      return;
    }

    const updates: Partial<Speaker> = {
      name: newSpeakerName.trim(),
      color: newSpeakerColor,
      defaultVisibility: editSpeakerVisibility,
    };

    updateSpeaker(editingSpeaker.id, updates);
    const updatedSpeakers = speakers.map((s) =>
      s.id === editingSpeaker.id ? { ...s, ...updates } : s
    );
    onSpeakersChange(updatedSpeakers);

    // Force editor decoration update
    if (editor) {
      editor.view.dispatch(editor.state.tr.setMeta("speakersUpdated", true));
    }

    // Reset form
    setEditingSpeaker(null);
    setNewSpeakerName("");
    setIsEditDialogOpen(false);

    toast.success(`Updated speaker: ${updates.name}`);
  }, [editingSpeaker, newSpeakerName, newSpeakerColor, editSpeakerVisibility, speakers, updateSpeaker, onSpeakersChange, editor]);

  const handleDeleteSpeaker = useCallback(() => {
    if (!deletingSpeaker) return;

    // Remove all speaker marks from the document
    if (editor) {
      editor.commands.removeSpeaker(deletingSpeaker.id);
    }

    removeSpeaker(deletingSpeaker.id);
    const updatedSpeakers = speakers.filter((s) => s.id !== deletingSpeaker.id);
    onSpeakersChange(updatedSpeakers);

    setDeletingSpeaker(null);
    setIsDeleteDialogOpen(false);

    toast.success(`Deleted speaker: ${deletingSpeaker.name}`);
  }, [deletingSpeaker, speakers, removeSpeaker, onSpeakersChange, editor]);

  const openEditDialog = useCallback((speaker: Speaker) => {
    setEditingSpeaker(speaker);
    setNewSpeakerName(speaker.name);
    setNewSpeakerColor(speaker.color);
    setEditSpeakerVisibility(speaker.defaultVisibility || "full");
    setIsEditDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((speaker: Speaker) => {
    setDeletingSpeaker(speaker);
    setIsDeleteDialogOpen(true);
  }, []);

  const openAddDialog = useCallback(() => {
    if (speakers.length >= 4) {
      toast.error("Maximum of 4 speakers allowed");
      return;
    }
    setNewSpeakerName("");
    setNewSpeakerColor(getNextSpeakerColor(speakers));
    setIsAddDialogOpen(true);
  }, [speakers]);

  // Listen for events to open speaker sidebar
  useEffect(() => {
    const handleOpenSidebar = () => {
      // Open the sidebar if not already open
      if (!isOpen) {
        // This will be handled by the parent component that controls isOpen
        // We just need to open the add dialog
        openAddDialog();
      } else {
        // Already open, just open the add dialog
        openAddDialog();
      }
    };

    window.addEventListener("speaker:openSidebar", handleOpenSidebar);
    return () => {
      window.removeEventListener("speaker:openSidebar", handleOpenSidebar);
    };
  }, [isOpen, openAddDialog]);

  if (!isOpen) return null;

  return (
    <>
      <div className="flex w-72 flex-col border-l bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-medium">Speakers</span>
            {speakers.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({speakers.length})
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Instructions */}
        <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Add speakers to assign dialogue. Select text and use the toolbar or slash commands.
        </div>

        {/* Speakers List */}
        <div className="flex-1 overflow-y-auto p-3">
          {speakers.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <Users className="mb-2 h-8 w-8" />
              <p className="text-sm">No speakers yet</p>
              <p className="text-xs">Add a speaker to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {speakers.map((speaker, index) => (
                <SpeakerCard
                  key={speaker.id}
                  speaker={speaker}
                  number={index + 1}
                  onEdit={() => openEditDialog(speaker)}
                  onDelete={() => openDeleteDialog(speaker)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Speaker Button */}
        <div className="border-t p-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={openAddDialog}
            disabled={speakers.length >= 4}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Speaker
            {speakers.length >= 4 && " (Max 4)"}
          </Button>
        </div>
      </div>

      {/* Add Speaker Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Speaker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Enter speaker name..."
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddSpeaker();
                  }
                }}
                autoFocus
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {defaultSpeakerColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewSpeakerColor(color)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      newSpeakerColor === color
                        ? "border-foreground ring-2 ring-foreground ring-offset-2"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSpeaker}>Add Speaker</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Speaker Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Speaker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Enter speaker name..."
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEditSpeaker();
                  }
                }}
                autoFocus
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {defaultSpeakerColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewSpeakerColor(color)}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      newSpeakerColor === color
                        ? "border-foreground ring-2 ring-foreground ring-offset-2"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Default Camera Mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Camera View</label>
              <div className="flex gap-2">
                {(["full", "corner", "voiceover"] as CameraMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={editSpeakerVisibility === mode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditSpeakerVisibility(mode)}
                  >
                    {cameraModeLabels[mode]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSpeaker}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Speaker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingSpeaker?.name}&rdquo;?
              This will remove all speaker attributions for this speaker from the document.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSpeaker}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SpeakerCardProps {
  speaker: Speaker;
  number: number;
  onEdit: () => void;
  onDelete: () => void;
}

function SpeakerCard({ speaker, number, onEdit, onDelete }: SpeakerCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-background p-3">
      <div className="flex items-center gap-3">
        {/* Number Badge */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {number}
        </div>
        {/* Color Swatch */}
        <div
          className="h-6 w-6 rounded-full border"
          style={{ backgroundColor: speaker.color }}
        />
        <div className="font-medium">{speaker.name}</div>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          title="Edit speaker"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDelete}
          title="Delete speaker"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
