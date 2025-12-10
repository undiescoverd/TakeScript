"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { StickyNote, X, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Fragment } from "@tiptap/pm/model";
import { useState, useRef, useEffect } from "react";

export function EditorNoteNodeView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(node.attrs.description || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local state when node attributes change
  useEffect(() => {
    if (!isEditingDescription) {
      setDescription(node.attrs.description || "");
    }
  }, [node.attrs.description, isEditingDescription]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingDescription && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingDescription]);

  const handleSaveDescription = () => {
    const pos = getPos();
    if (typeof pos === "number") {
      editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const currentNode = state.doc.nodeAt(pos);
          if (currentNode && currentNode.type.name === "editorNote") {
            tr.setNodeMarkup(pos, undefined, {
              ...currentNode.attrs,
              description: description || null,
            });
          }
          return true;
        })
        .run();
    }
    setIsEditingDescription(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // Prevent Tiptap from capturing the event
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveDescription();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDescription(node.attrs.description || "");
      setIsEditingDescription(false);
    }
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

    // Replace the wrapper with its inner content
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const start = pos;
        const end = pos + currentNode.nodeSize;

        // Replace with the inner block content
        tr.replaceWith(start, end, Fragment.from(innerContent));
        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper className="editor-note-node-view">
      <div className="group relative my-4 rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <StickyNote className="h-5 w-5" />
            <span className="font-medium text-sm uppercase tracking-wide">Editor Note</span>
            <span className="text-xs text-muted-foreground">(hidden in recording mode)</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-muted rounded"
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

        {/* Description field */}
        <div className="mt-2 mb-2">
          {isEditingDescription ? (
            <input
              ref={inputRef}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              onKeyDown={handleKeyDown}
              className="w-full text-sm px-2 py-1 rounded border border-yellow-300 dark:border-yellow-600 bg-white dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 placeholder:text-yellow-400 dark:placeholder:text-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
              placeholder="Describe this note..."
            />
          ) : (
            <div
              onClick={() => setIsEditingDescription(true)}
              className="flex items-center gap-1 text-sm text-yellow-600/70 dark:text-yellow-400/70 cursor-pointer hover:text-yellow-700 dark:hover:text-yellow-300 transition-colors group/desc"
            >
              {node.attrs.description ? (
                <span className="italic">{node.attrs.description}</span>
              ) : (
                <span className="italic opacity-60">Click to add description...</span>
              )}
              <Pencil className="h-3 w-3 opacity-0 group-hover/desc:opacity-100 transition-opacity" />
            </div>
          )}
        </div>

        <div className="text-sm">
          <NodeViewContent className="editor-note-content min-h-[1.5em]" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
