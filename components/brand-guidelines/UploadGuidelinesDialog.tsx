"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadGuidelinesDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractedText, setExtractedText] = useState("");

  const generateUploadUrl = useAction(api.fileUpload.generateUploadUrl);
  const extractText = useAction(api.fileUpload.extractTextFromFile);
  const recordUpload = useMutation(api.fileUploads.recordUpload);
  const uploadGuideline = useMutation(api.brandGuidelines.upload);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setName(selectedFile.name.replace(/\.[^/.]+$/, ""));

    // Auto-extract text for preview (TXT files only)
    if (selectedFile.type === "text/plain") {
      const text = await selectedFile.text();
      setExtractedText(text);
    } else {
      setExtractedText("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      // 1. Generate upload URL
      const uploadUrl = await generateUploadUrl();

      // 2. Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        body: file,
      });

      const { storageId } = await result.json();

      // 3. Record ownership so extractTextFromFile (and any later
      // delete/metadata calls) can verify we're the uploader
      await recordUpload({ storageId });

      // 4. Extract text from file
      const fileType = file.type.includes("pdf")
        ? "pdf"
        : file.type.includes("wordprocessingml") || file.name.endsWith(".docx")
        ? "docx"
        : "txt";

      const content = extractedText || (await extractText({ storageId, fileType }));

      // 5. Save to database
      await uploadGuideline({
        name,
        content,
        fileUrl: storageId,
        fileType,
        isActive,
      });

      toast.success("Brand guidelines uploaded successfully");

      // Reset and close
      setFile(null);
      setName("");
      setExtractedText("");
      onOpenChange(false);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Brand Guidelines</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Supported formats: TXT, PDF, DOCX (max 10MB)
            </p>
          </div>

          {file && (
            <>
              <div>
                <Label htmlFor="name">Guideline Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Brand Voice Guidelines 2025"
                  disabled={uploading}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked as boolean)}
                  disabled={uploading}
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Set as active guideline
                </Label>
              </div>

              {extractedText && (
                <div>
                  <Label>Preview (first 500 characters)</Label>
                  <div className="mt-2 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto">
                    {extractedText.slice(0, 500)}
                    {extractedText.length > 500 && "..."}
                  </div>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading || !name}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Guideline
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
