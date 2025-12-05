"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface EditTemplateDialogProps {
  templateId: Id<"templates">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentScriptContent?: string; // Optional: current script content to update template
}

export function EditTemplateDialog({
  templateId,
  open,
  onOpenChange,
  currentScriptContent,
}: EditTemplateDialogProps) {
  const template = useQuery(api.templates.get, { templateId });
  const updateTemplate = useMutation(api.templates.update);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [updateContent, setUpdateContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form fields when template loads
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setCategory(template.category || "");
    }
  }, [template]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setUpdateContent(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsSaving(true);
    try {
      await updateTemplate({
        templateId,
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        content: updateContent && currentScriptContent ? currentScriptContent : undefined,
      });
      onOpenChange(false);
      toast.success("Template updated successfully");
    } catch (error) {
      console.error("Failed to update template:", error);
      toast.error("Failed to update template");
    } finally {
      setIsSaving(false);
    }
  };

  if (!template) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-template-name">Template Name *</Label>
            <Input
              id="edit-template-name"
              placeholder="e.g., Product Demo Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-template-description">Description</Label>
            <Textarea
              id="edit-template-description"
              placeholder="Describe what this template is for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-template-category">Category</Label>
            <Input
              id="edit-template-category"
              placeholder="e.g., Product Demos, Tutorials"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          {currentScriptContent && (
            <div className="flex items-start space-x-2 rounded-lg border p-4">
              <Checkbox
                id="update-content"
                checked={updateContent}
                onCheckedChange={(checked) => setUpdateContent(checked as boolean)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="update-content"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Update template content
                </Label>
                <p className="text-sm text-muted-foreground">
                  Replace the template structure with the current script content
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
