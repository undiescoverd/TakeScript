"use client";

import { JSONContent } from "@tiptap/react";
import { useMemo } from "react";
import { extractChapters } from "@/lib/tiptap/export";
import { useEditorStore } from "@/store/editor-store";

interface ChromeMouseHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

interface BeatBoardProps {
  content: JSONContent;
  onChapterClick: (chapterId: string) => void;
  chromeMouseHandlers?: ChromeMouseHandlers;
}

// Focus mode only. In edit mode the Outline sidebar already lists the same
// chapters and navigates the same way, so rendering cards here duplicated it.
export function BeatBoard({ content, onChapterClick, chromeMouseHandlers }: BeatBoardProps) {
  const chapters = useMemo(() => extractChapters(content), [content]);
  const { viewMode } = useEditorStore();

  if (chapters.length === 0 || viewMode !== "focus") {
    return null;
  }

  return (
    <div className="beatboard-focus-wrapper" {...chromeMouseHandlers}>
      <div className="beatboard-focus">
        {chapters.map((chapter, index) => (
          <button
            key={chapter.id}
            onClick={() => onChapterClick(chapter.id)}
            className="beatboard-pill"
            title={chapter.title}
          >
            {index + 1}. {chapter.title}
          </button>
        ))}
      </div>
    </div>
  );
}
