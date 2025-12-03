"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { Input } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Edit2, Check, X } from "lucide-react";

export function ChapterNodeView({ node, updateAttributes }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(node.attrs.title || "Untitled Chapter");
  const [duration, setDuration] = useState(node.attrs.duration || "");

  const handleSave = () => {
    updateAttributes({ title, duration });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(node.attrs.title || "Untitled Chapter");
    setDuration(node.attrs.duration || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <NodeViewWrapper className="chapter-node-view">
        <div className="mb-6 mt-8 space-y-3 rounded-lg border-2 border-primary bg-accent p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Chapter Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Enter chapter title"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Duration (optional)</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="e.g., 2m, 30s, 1m 30s"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Check className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="chapter-node-view">
      <div
        className="group relative mb-6 mt-8 border-l-4 border-primary pl-4 py-2 cursor-pointer hover:bg-accent/50 rounded-r transition-colors"
        data-id={node.attrs.id}
        onClick={() => setIsEditing(true)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-lg font-bold uppercase text-primary">
              {node.attrs.title || "Untitled Chapter"}
            </div>
            {node.attrs.duration && (
              <div className="text-sm text-muted-foreground">
                Duration: {node.attrs.duration}
              </div>
            )}
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-accent rounded"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Edit2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-2">
          <NodeViewContent className="chapter-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
