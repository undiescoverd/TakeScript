"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { Monitor, Trash2 } from "lucide-react";

export function ScreenRecordingNodeView({ deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper className="screen-recording-node-view">
      <div className="group relative my-4 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Monitor className="h-5 w-5" />
            <span className="font-medium text-sm uppercase tracking-wide">Screen Recording</span>
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            title="Delete screen recording block"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          <NodeViewContent className="screen-recording-content min-h-[1.5em]" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
