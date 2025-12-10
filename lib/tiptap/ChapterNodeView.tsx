"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { useState, useEffect, useRef } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Fragment } from "@tiptap/pm/model";

export function ChapterNodeView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  // Auto-open edit mode for newly created chapters (with default title "New Chapter")
  const initialTitle = node.attrs.title || "Untitled Chapter";
  const isNewChapter = initialTitle === "New Chapter";
  const [isEditing, setIsEditing] = useState(isNewChapter);
  const [title, setTitle] = useState(initialTitle);
  const [duration, setDuration] = useState(node.attrs.duration || "");

  // Update local state when node attributes change (only when not editing to avoid interfering with user input)
  useEffect(() => {
    if (!isEditing) {
      setTitle(node.attrs.title || "Untitled Chapter");
      setDuration(node.attrs.duration || "");
    }
  }, [node.attrs.title, node.attrs.duration, isEditing]);

  const handleSave = () => {
    const pos = getPos();
    if (typeof pos === "number") {
      // Use editor chain to update attributes - more reliable than direct updateAttributes
      editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const node = state.doc.nodeAt(pos);
          if (node && node.type.name === "chapter") {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              title,
              duration: duration || null,
            });
          }
          return true;
        })
        .run();
    } else {
      // Fallback: try direct updateAttributes with error handling
      try {
        updateAttributes({ title, duration: duration || null });
      } catch (error) {
        console.error("Failed to update chapter attributes:", error);
      }
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    // If this is a new chapter that was never saved (still has default title),
    // remove the block entirely instead of just closing the dialog
    const currentTitle = node.attrs.title || "Untitled Chapter";
    if (currentTitle === "New Chapter" || currentTitle === "Untitled Chapter") {
      handleRemoveBlock();
      return;
    }

    setTitle(currentTitle);
    setDuration(node.attrs.duration || "");
    setIsEditing(false);
  };

  const handleRemoveBlock = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;

    const currentNode = editor.state.doc.nodeAt(pos);
    if (!currentNode) return;

    // Extract the inner content (preserving block structure like lists, paragraphs)
    const innerContent: typeof currentNode[] = [];
    currentNode.forEach((child) => {
      innerContent.push(child);
    });

    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const start = pos;
        const end = pos + currentNode.nodeSize;

        // If there's content inside the chapter, preserve it
        // Otherwise, just delete the chapter block entirely
        if (innerContent.length > 0) {
          tr.replaceWith(start, end, Fragment.from(innerContent));
        } else {
          // No content - just delete the chapter block
          tr.delete(start, end);
        }
        return true;
      })
      .run();
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
        className="group relative mb-6 mt-8 border-l-4 border-primary pl-4 py-2 cursor-pointer hover:bg-accent/50 rounded-r-lg transition-colors"
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
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 hover:bg-accent rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit chapter</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 hover:bg-muted rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveBlock();
                  }}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove block (keep content)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="mt-2">
          <NodeViewContent className="chapter-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
