"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { useState, useEffect, useRef } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Fragment } from "@tiptap/pm/model";

export function ThumbnailTitleNodeView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  // Auto-open edit mode ONLY for newly created thumbnail titles with the default placeholder title
  const initialTitle = node.attrs.title || "Thumbnail Title";
  const isNewThumbnailNeedingInput = initialTitle === "Thumbnail Title";
  const [isEditing, setIsEditing] = useState(isNewThumbnailNeedingInput);
  const [title, setTitle] = useState(isNewThumbnailNeedingInput ? "" : initialTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Update local state when node attributes change (only when not editing to avoid interfering with user input)
  useEffect(() => {
    if (!isEditing) {
      const currentTitle = node.attrs.title || "Thumbnail Title";
      setTitle(currentTitle === "Thumbnail Title" ? "" : currentTitle);
    }
  }, [node.attrs.title, isEditing]);

  // Focus the title input when entering edit mode (especially for new thumbnail titles)
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      // Use setTimeout to ensure the DOM is fully rendered
      const timeoutId = setTimeout(() => {
        titleInputRef.current?.focus();
        // Select all text if it's the default "Thumbnail Title"
        if (title === "Thumbnail Title") {
          titleInputRef.current?.select();
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing, title]);

  const handleSave = () => {
    updateAttributes({ title: title.trim() || "Thumbnail Title" });
    setIsEditing(false);
  };

  const handleCancel = () => {
    // If this is a new thumbnail title that was never saved (still has default title),
    // remove the block entirely instead of just closing the dialog
    const currentTitle = node.attrs.title || "Thumbnail Title";
    if (currentTitle === "Thumbnail Title") {
      handleRemoveBlock();
      return;
    }

    setTitle(currentTitle);
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    // Clear the title if it's the default placeholder
    const currentTitle = node.attrs.title || "Thumbnail Title";
    if (currentTitle === "Thumbnail Title") {
      setTitle("");
    } else {
      setTitle(currentTitle);
    }
    setIsEditing(true);
  };

  const handleRemoveBlock = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;

    const currentNode = editor.state.doc.nodeAt(pos);
    if (!currentNode) return;

    // Extract the inner content (preserving block structure)
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

        // If there's content inside, preserve it
        if (innerContent.length > 0) {
          tr.replaceWith(start, end, Fragment.from(innerContent));
        } else {
          // No content - just delete the block
          tr.delete(start, end);
        }
        return true;
      })
      .run();
  };

  if (isEditing) {
    return (
      <NodeViewWrapper className="thumbnail-title-node-view">
        <div className="mb-6 mt-8 space-y-3 rounded-lg border-2 bg-accent p-4" style={{ borderColor: '#8b5cf6' }}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Thumbnail Title</label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Enter thumbnail title"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancel();
                }
              }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-white hover:opacity-90"
              style={{ backgroundColor: '#8b5cf6' }}
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
    <NodeViewWrapper className="thumbnail-title-node-view">
      <div
        className="group relative mb-6 mt-8 border-l-4 pl-4 py-2 cursor-pointer hover:bg-accent/50 rounded-r-lg transition-colors"
        style={{ borderLeftColor: '#8b5cf6' }}
        data-id={node.attrs.id}
        onClick={handleStartEditing}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-[10px] font-medium uppercase tracking-wide mb-1 opacity-60" style={{ color: '#8b5cf6' }}>
              Thumbnail Title
            </div>
            <div className="text-lg font-bold uppercase" style={{ color: '#8b5cf6' }}>
              {node.attrs.title || "Thumbnail Title"}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="p-1.5 hover:bg-accent rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEditing();
                  }}
                >
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit thumbnail title</p>
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
          <NodeViewContent className="thumbnail-title-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
