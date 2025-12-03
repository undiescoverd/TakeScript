"use client";

import { JSONContent } from "@tiptap/react";
import { useMemo } from "react";
import { extractChapters } from "@/lib/tiptap/export";

interface BeatBoardProps {
  content: JSONContent;
  onChapterClick: (chapterId: string) => void;
}

export function BeatBoard({ content, onChapterClick }: BeatBoardProps) {
  const chapters = useMemo(() => extractChapters(content), [content]);

  if (chapters.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-3 overflow-x-auto border-b bg-card p-4">
      {chapters.map((chapter, index) => (
        <button
          key={chapter.id}
          onClick={() => onChapterClick(chapter.id)}
          className="flex-shrink-0 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary"
          style={{ minWidth: "160px" }}
        >
          <div className="mb-1 text-lg">📑</div>
          <div className="text-sm font-medium line-clamp-2">{chapter.title}</div>
          {chapter.duration && (
            <div className="mt-1 text-xs text-muted-foreground">
              {chapter.duration}
            </div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            Chapter {index + 1}
          </div>
        </button>
      ))}
    </div>
  );
}
