"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { useState, useEffect, useRef } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Fragment } from "@tiptap/pm/model";

export function ChapterNodeView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  // Auto-open edit mode ONLY for newly created chapters with the default placeholder title
  // If a selection was used to create the chapter, the title will be the selected text, not "New Chapter"
  const initialTitle = node.attrs.title || "Untitled Chapter";
  const isNewChapterNeedingInput = initialTitle === "New Chapter";
  const [isEditing, setIsEditing] = useState(isNewChapterNeedingInput);
  const [title, setTitle] = useState(initialTitle);
  const [duration, setDuration] = useState(node.attrs.duration || "");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Update local state when node attributes change (only when not editing to avoid interfering with user input)
  useEffect(() => {
    if (!isEditing) {
      setTitle(node.attrs.title || "Untitled Chapter");
      setDuration(node.attrs.duration || "");
    }
  }, [node.attrs.title, node.attrs.duration, isEditing]);

  // Focus the title input when entering edit mode (especially for new chapters)
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      // Use setTimeout to ensure the DOM is fully rendered
      const timeoutId = setTimeout(() => {
        titleInputRef.current?.focus();
        // Select all text if it's the default "New Chapter" title
        if (title === "New Chapter") {
          titleInputRef.current?.select();
        }
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing, title]);

  const handleSave = () => {
    // Use updateAttributes as primary method - it's the Tiptap way and handles validation
    try {
      updateAttributes({ title, duration: duration || null });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update chapter attributes:", error);
      // If updateAttributes fails, try manual transaction as fallback
      const pos = getPos();
      if (typeof pos === "number") {
        editor
          .chain()
          .focus()
          .command(({ tr, state }) => {
            try {
              // Validate position is within document bounds
              if (pos < 0 || pos >= state.doc.content.size) {
                console.error("Invalid position for chapter update");
                return false;
              }

              const node = state.doc.nodeAt(pos);
              
              if (!node || node.type.name !== "chapter") {
                console.error("Node at position is not a chapter");
                return false;
              }

              // Ensure node has valid content (at least one block) before updating
              // Chapter requires "block+" content, so we need at least one block
              if (node.content.size === 0) {
                // Node has no content - replace with new node that has a paragraph
                const paragraph = state.schema.nodes.paragraph.create(
                  {},
                  state.schema.text("")
                );
                const newChapter = node.type.create(
                  {
                    ...node.attrs,
                    title,
                    duration: duration || null,
                  },
                  paragraph
                );
                tr.replaceWith(pos, pos + node.nodeSize, newChapter);
              } else {
                // Node has content - just update attributes
                tr.setNodeMarkup(pos, node.type, {
                  ...node.attrs,
                  title,
                  duration: duration || null,
                });
              }
              return true;
            } catch (err) {
              console.error("Error in fallback update:", err);
              return false;
            }
          })
          .run();
      }
      setIsEditing(false);
    }
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
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Enter chapter title"
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
        className="group relative my-10 cursor-pointer"
        data-id={node.attrs.id}
        onClick={() => setIsEditing(true)}
      >
        {/* Minimalist divider chapter header - stacked layout for multi-line support */}
        <div className="relative">
          {/* Horizontal line that spans full width */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />

          {/* Center content with background to "cut through" the line */}
          <div className="relative flex justify-center">
            <div className="flex items-center gap-2 bg-background px-4 text-muted-foreground">
              <span className="text-[11pt] font-semibold uppercase tracking-[0.2em] text-center">
                {node.attrs.title || "Untitled Chapter"}
              </span>
              {node.attrs.duration && (
                <span className="text-[9pt] font-normal tracking-normal whitespace-nowrap">
                  ({node.attrs.duration})
                </span>
              )}

              {/* Edit/Remove buttons - appear on hover */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-1 hover:bg-accent rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit chapter</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-1 hover:bg-muted rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBlock();
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove block (keep content)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Chapter content (if any) */}
        <div className="mt-4">
          <NodeViewContent className="chapter-content" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
