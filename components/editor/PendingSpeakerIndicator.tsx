"use client";

import { useEffect, useState, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { useSpeakerStore } from "@/store/speaker-store";
import { cameraModeLabels } from "@/lib/tiptap/speaker-mark";

interface PendingSpeakerIndicatorProps {
  editor: Editor;
}

export function PendingSpeakerIndicator({ editor }: PendingSpeakerIndicatorProps) {
  const { speakers, pendingSpeakerId, pendingCameraMode, clearPendingSpeaker } = useSpeakerStore();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Get pending speaker details
  const pendingSpeaker = pendingSpeakerId
    ? speakers.find(s => s.id === pendingSpeakerId)
    : null;

  // Update position based on cursor
  const updatePosition = useCallback(() => {
    if (!editor || !pendingSpeaker) {
      setPosition(null);
      return;
    }

    const { selection } = editor.state;
    const { from } = selection;

    try {
      const coords = editor.view.coordsAtPos(from);
      const editorRect = editor.view.dom.getBoundingClientRect();

      // Position above and slightly to the right of cursor
      setPosition({
        top: coords.top - editorRect.top - 32,
        left: coords.left - editorRect.left,
      });
    } catch {
      setPosition(null);
    }
  }, [editor, pendingSpeaker]);

  // Listen for selection changes to update position
  useEffect(() => {
    if (!editor || !pendingSpeaker) {
      setIsVisible(false);
      return;
    }

    updatePosition();
    setIsVisible(true);

    const handleSelectionUpdate = () => {
      updatePosition();
    };

    editor.on("selectionUpdate", handleSelectionUpdate);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, pendingSpeaker, updatePosition]);

  // Clear pending speaker on Escape
  useEffect(() => {
    if (!pendingSpeaker) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearPendingSpeaker();
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pendingSpeaker, clearPendingSpeaker]);

  // Clear pending when clicking outside editor
  useEffect(() => {
    if (!pendingSpeaker || !editor) return;

    const handleClick = (e: MouseEvent) => {
      const editorDom = editor.view.dom;
      if (!editorDom.contains(e.target as Node)) {
        clearPendingSpeaker();
      }
    };

    // Delay adding listener to avoid clearing on the same click that triggered pending
    const timeout = setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("click", handleClick);
    };
  }, [pendingSpeaker, editor, clearPendingSpeaker]);

  if (!pendingSpeaker || !position || !isVisible) {
    return null;
  }

  const cameraLabel = pendingCameraMode
    ? cameraModeLabels[pendingCameraMode]
    : null;

  return (
    <div
      className="absolute z-50 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide whitespace-nowrap shadow-sm"
        style={{
          backgroundColor: `color-mix(in oklch, ${pendingSpeaker.color} 25%, transparent)`,
          color: pendingSpeaker.color,
          border: `1px solid color-mix(in oklch, ${pendingSpeaker.color} 40%, transparent)`,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: pendingSpeaker.color }} />
        <span>{pendingSpeaker.name}</span>
        {cameraLabel && (
          <span className="opacity-75 ml-0.5">[{cameraLabel}]</span>
        )}
      </div>
    </div>
  );
}
