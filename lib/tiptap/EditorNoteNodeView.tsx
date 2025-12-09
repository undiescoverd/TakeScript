"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { StickyNote, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function EditorNoteNodeView({ editor, getPos }: NodeViewProps) {
  const handleRemoveBlock = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;

    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    // Get the text content from this node
    const textContent = node.textContent;

    // Replace the block with a paragraph containing the same text
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const start = pos;
        const end = pos + node.nodeSize;

        // Create a paragraph with the text content
        const paragraph = editor.schema.nodes.paragraph.create(
          null,
          textContent ? editor.schema.text(textContent) : null
        );

        tr.replaceWith(start, end, paragraph);
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
              <p>Remove block (keep text)</p>
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
