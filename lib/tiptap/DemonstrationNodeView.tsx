"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { Play, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function DemonstrationNodeView({ editor, getPos, node }: NodeViewProps) {
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
    <NodeViewWrapper className="demonstration-node-view">
      <div className="group relative my-4 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Play className="h-5 w-5" />
            <span className="font-medium text-sm uppercase tracking-wide">Demonstration</span>
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
        <div className="mt-2 text-sm text-muted-foreground">
          <NodeViewContent className="demonstration-content min-h-[1.5em]" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
