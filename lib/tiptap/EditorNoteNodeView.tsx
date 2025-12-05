"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { StickyNote, Trash2 } from "lucide-react";

export function EditorNoteNodeView({ deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper className="editor-note-node-view">
      <div className="group relative my-4 rounded-lg border-2 border-dashed border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <StickyNote className="h-5 w-5" />
            <span className="font-medium text-sm uppercase tracking-wide">Editor Note</span>
            <span className="text-xs text-muted-foreground">(hidden in recording mode)</span>
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            title="Delete editor note"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
        <div className="mt-2 text-sm">
          <NodeViewContent className="editor-note-content min-h-[1.5em]" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
