"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Trash2, Check, Upload } from "lucide-react";
import { useState } from "react";
import { UploadGuidelinesDialog } from "./UploadGuidelinesDialog";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface BrandGuideline {
  _id: Id<"brandGuidelines">;
  organizationId: Id<"organizations">;
  name: string;
  content: string;
  fileUrl?: string;
  fileType: string;
  uploadedBy: Id<"users">;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export function BrandGuidelinesManager() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<Id<"brandGuidelines"> | null>(null);

  const guidelines = useQuery(api.brandGuidelines.list);
  const setActive = useMutation(api.brandGuidelines.setActive);
  const remove = useMutation(api.brandGuidelines.remove);

  const handleSetActive = async (guidelineId: Id<"brandGuidelines">) => {
    try {
      await setActive({ guidelineId });
      toast.success("Guideline set as active");
    } catch (error) {
      toast.error("Failed to set guideline as active");
    }
  };

  const handleDelete = async (guidelineId: Id<"brandGuidelines">) => {
    if (confirm("Delete this guideline? This cannot be undone.")) {
      try {
        await remove({ guidelineId });
        toast.success("Guideline deleted");
      } catch (error) {
        toast.error("Failed to delete guideline");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Brand Guidelines</h2>
          <p className="text-muted-foreground">
            Manage your organization's brand voice and style guidelines
          </p>
        </div>

        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Guidelines
        </Button>
      </div>

      {guidelines === undefined ? (
        <p>Loading...</p>
      ) : guidelines.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Guidelines Yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your brand guidelines to help AI provide more consistent suggestions
          </p>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Your First Guideline
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {guidelines.map((guideline: BrandGuideline) => (
            <Card key={guideline._id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{guideline.name}</h3>
                    {guideline.isActive && (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Active
                      </Badge>
                    )}
                    <Badge variant="outline">{guideline.fileType.toUpperCase()}</Badge>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2">
                    Uploaded {new Date(guideline.createdAt).toLocaleDateString()}
                  </p>

                  {expandedId === guideline._id && (
                    <div className="mt-3 p-3 bg-muted rounded-md text-sm max-h-64 overflow-y-auto">
                      {guideline.content}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setExpandedId(expandedId === guideline._id ? null : guideline._id)
                    }
                  >
                    {expandedId === guideline._id ? "Hide" : "Preview"}
                  </Button>

                  {!guideline.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetActive(guideline._id)}
                    >
                      Set Active
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(guideline._id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <UploadGuidelinesDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </div>
  );
}
