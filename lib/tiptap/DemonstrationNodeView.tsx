"use client";

import { NodeViewWrapper, NodeViewContent, NodeViewProps } from "@tiptap/react";
import { Play, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function DemonstrationNodeView({ deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper className="demonstration-node-view">
      <div className="group relative my-4 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Play className="h-5 w-5" />
            <span className="font-medium text-sm uppercase tracking-wide">Demonstration</span>
          </div>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-destructive/10 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete demonstration block</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          <NodeViewContent className="demonstration-content min-h-[1.5em]" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
