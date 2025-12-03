"use client";

import { JSONContent } from "@tiptap/react";
import { useMemo } from "react";
import { useEditorStore } from "@/store/editor-store";
import { extractChapters } from "@/lib/tiptap/export";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

interface SidebarProps {
  content: JSONContent;
  onChapterClick: (chapterId: string) => void;
}

export function Sidebar({ content, onChapterClick }: SidebarProps) {
  const { sidebarOpen, toggleSidebar } = useEditorStore();
  const chapters = useMemo(() => extractChapters(content), [content]);

  if (!sidebarOpen) {
    return (
      <div className="border-r bg-card p-2">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-64 flex-col border-r bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <span className="text-sm font-medium">Outline</span>
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {chapters.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <FileText className="mb-2 h-8 w-8" />
            <p className="text-sm">No chapters yet</p>
            <p className="text-xs">Type /chapter to add one</p>
          </div>
        ) : (
          <div className="space-y-1">
            {chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                onClick={() => onChapterClick(chapter.id)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="text-muted-foreground">{index + 1}.</span>
                <span className="flex-1 truncate">{chapter.title}</span>
                {chapter.duration && (
                  <span className="text-xs text-muted-foreground">
                    {chapter.duration}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
