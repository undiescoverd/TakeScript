"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { StickyNote, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Fragment } from "@tiptap/pm/model";

export function EditorNoteNodeView({ editor, getPos }: NodeViewProps) {
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
        <div className="mt-2 text-sm">
          <NodeViewContent className="editor-note-content min-h-[1.5em]" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
