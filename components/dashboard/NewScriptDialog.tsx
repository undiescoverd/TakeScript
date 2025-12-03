"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, BookOpen, Video, GraduationCap, MousePointer } from "lucide-react";
import { toast } from "sonner";
import { TemplateCard } from "./TemplateCard";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    value: "tutorial",
    label: "Tutorial",
    icon: BookOpen,
    description: "Step-by-step guide with chapters and clear instructions",
  },
  {
    value: "demo",
    label: "Demo",
    icon: Video,
    description: "Product demonstration with screen recordings",
  },
  {
    value: "training",
    label: "Training",
    icon: GraduationCap,
    description: "Educational content with demonstrations",
  },
  {
    value: "product-walkthrough",
    label: "Product Walkthrough",
    icon: MousePointer,
    description: "Comprehensive feature overview",
  },
];

interface FormData {
  title: string;
  templateType?: string;
  targetLength?: number;
  targetType?: "pages" | "minutes";
  category?: string;
}

export function NewScriptDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    targetType: "minutes",
  });
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const createScript = useMutation(api.scripts.create);

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsCreating(true);
    try {
      const scriptId = await createScript({
        title: formData.title.trim(),
        templateType: formData.templateType,
        targetLength: formData.targetLength,
        targetType: formData.targetType,
        category: formData.category,
      });
      setOpen(false);
      resetForm();
      router.push(`/script/${scriptId}`);
      toast.success("Script created");
    } catch {
      toast.error("Failed to create script");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({ title: "", targetType: "minutes" });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const canProceedToStep2 = formData.title.trim().length > 0;
  const canProceedToStep3 = true; // Step 2 fields are all optional

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Script
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">New Script</DialogTitle>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 border-b pb-4">
          {[1, 2, 3].map((num) => (
            <div key={num} className="flex items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  step === num
                    ? "bg-primary text-primary-foreground"
                    : step > num
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {num}
              </div>
              <span
                className={cn(
                  "ml-2 text-sm font-medium",
                  step === num ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {num === 1 ? "Script Details" : num === 2 ? "Planning" : "Review"}
              </span>
              {num < 3 && (
                <div className="mx-4 h-px w-12 bg-border" />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-6 py-4">
          {/* Step 1: Script Details */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter script title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <Label>Template (optional)</Label>
                <p className="text-sm text-muted-foreground">
                  Choose a template to start with pre-built structure
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {TEMPLATES.map((template) => (
                    <TemplateCard
                      key={template.value}
                      icon={template.icon}
                      title={template.label}
                      description={template.description}
                      value={template.value}
                      selected={formData.templateType === template.value}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          templateType:
                            formData.templateType === template.value
                              ? undefined
                              : template.value,
                        })
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Planning */}
          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                You can always change this later, feel free to skip any fields
              </p>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="targetLength">Target Length</Label>
                  <div className="flex gap-2">
                    <Input
                      id="targetLength"
                      type="number"
                      min="1"
                      placeholder="10"
                      value={formData.targetLength || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          targetLength: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      className="flex-1"
                    />
                    <Select
                      value={formData.targetType}
                      onValueChange={(value: "pages" | "minutes") =>
                        setFormData({ ...formData, targetType: value })
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="pages">Pages</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Project/Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Onboarding Videos"
                    value={formData.category || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Collaboration features are coming soon.
                  You'll be able to invite team members to edit scripts together.
                </p>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!canProceedToStep3}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Title</p>
                  <p className="font-medium">{formData.title}</p>
                </div>

                {formData.templateType && (
                  <div>
                    <p className="text-sm text-muted-foreground">Template</p>
                    <p className="font-medium">
                      {TEMPLATES.find((t) => t.value === formData.templateType)
                        ?.label}
                    </p>
                  </div>
                )}

                {formData.targetLength && (
                  <div>
                    <p className="text-sm text-muted-foreground">Target Length</p>
                    <p className="font-medium">
                      {formData.targetLength}{" "}
                      {formData.targetType === "pages" ? "pages" : "minutes"}
                    </p>
                  </div>
                )}

                {formData.category && (
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{formData.category}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Script"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
