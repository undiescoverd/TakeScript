"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  scriptId: Id<"scripts">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (content: string) => void;
  initialPrompt?: string;
  initialTask?: "generate" | "expand" | "rephrase" | "summarize";
  context?: string;
}

export function AIGenerationDialog({
  scriptId,
  open,
  onOpenChange,
  onInsert,
  initialPrompt = "",
  initialTask = "generate",
  context = "",
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [task, setTask] = useState<"generate" | "expand" | "rephrase" | "summarize">(
    initialTask
  );
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");

  // Update prompt and task when props change
  useEffect(() => {
    setPrompt(initialPrompt);
    setTask(initialTask);
  }, [initialPrompt, initialTask]);

  const generateContent = useAction(api.ai.generateContent);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setGeneratedContent("");

    try {
      const result = await generateContent({
        scriptId,
        prompt: prompt.trim(),
        task,
        context,
      });

      setGeneratedContent(result.generatedContent);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate content. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleInsert = () => {
    if (generatedContent) {
      onInsert(generatedContent);
      setPrompt("");
      setGeneratedContent("");
      onOpenChange(false);
      toast.success("Content inserted");
    }
  };

  const handleReset = () => {
    setPrompt(initialPrompt);
    setGeneratedContent("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Content Generation
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <Label htmlFor="task">Task</Label>
            <Select value={task} onValueChange={(value: any) => setTask(value)}>
              <SelectTrigger id="task">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generate">Generate New Content</SelectItem>
                <SelectItem value="expand">Expand with Details</SelectItem>
                <SelectItem value="rephrase">Rephrase for Clarity</SelectItem>
                <SelectItem value="summarize">Summarize</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="prompt">
              {task === "generate" ? "What would you like to write?" : "Text to process"}
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                task === "generate"
                  ? "Describe what you want to write..."
                  : "Enter or paste text here..."
              }
              rows={4}
              disabled={generating}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="flex-1"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
            {generatedContent && (
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>

          {generatedContent && (
            <div>
              <Label>Generated Content</Label>
              <div className="mt-2 p-4 bg-muted rounded-md text-sm max-h-64 overflow-y-auto whitespace-pre-wrap">
                {generatedContent}
              </div>
              <Button onClick={handleInsert} className="w-full mt-3">
                Insert into Script
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
