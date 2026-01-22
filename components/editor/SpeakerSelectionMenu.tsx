"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useSpeakerStore } from "@/store/speaker-store";

export interface SpeakerSelectionMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SpeakerSelectionMenuProps {
  onSelect: (speakerId: string) => void;
  clientRect?: (() => DOMRect | null) | null;
}

export const SpeakerSelectionMenu = forwardRef<
  SpeakerSelectionMenuRef,
  SpeakerSelectionMenuProps
>(({ onSelect, clientRect }, ref) => {
  const { speakers } = useSpeakerStore();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when speakers change
  useEffect(() => {
    setSelectedIndex(0);
  }, [speakers]);

  const selectSpeaker = useCallback(
    (index: number) => {
      const speaker = speakers[index];
      if (speaker) {
        onSelect(speaker.id);
      }
    },
    [onSelect, speakers]
  );

  // Expose keyboard handler to parent via ref
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      console.log("[SpeakerSelectionMenu] Key pressed:", event.key);

      // Number keys 1-4
      if (event.key >= "1" && event.key <= "4") {
        const index = parseInt(event.key) - 1;
        console.log("[SpeakerSelectionMenu] Number key pressed, selecting speaker at index:", index);
        if (index < speakers.length) {
          selectSpeaker(index);
          return true;
        }
      }

      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : speakers.length - 1));
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev < speakers.length - 1 ? prev + 1 : 0));
        return true;
      }

      if (event.key === "Enter") {
        console.log("[SpeakerSelectionMenu] Enter pressed, selecting speaker at index:", selectedIndex);
        selectSpeaker(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  // Calculate position from clientRect with dynamic positioning
  const rect = clientRect?.();

  // Dynamic positioning logic to prevent overflow
  const calculatePosition = () => {
    if (!rect) return { display: "none" as const };

    const MENU_MAX_HEIGHT = 250; // Approximate height for 4 speakers
    const MENU_WIDTH = 240;
    const SPACING = 8;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow >= MENU_MAX_HEIGHT + SPACING) {
      top = rect.bottom + SPACING;
    } else if (spaceAbove >= MENU_MAX_HEIGHT + SPACING) {
      top = rect.top - MENU_MAX_HEIGHT - SPACING;
    } else if (spaceBelow >= spaceAbove) {
      top = rect.bottom + SPACING;
    } else {
      top = Math.max(SPACING, rect.top - MENU_MAX_HEIGHT - SPACING);
    }

    let left = rect.left;
    if (left + MENU_WIDTH > viewportWidth) {
      left = Math.max(SPACING, viewportWidth - MENU_WIDTH - SPACING);
    }

    return {
      position: "fixed" as const,
      top,
      left,
      zIndex: 9999,
    };
  };

  const style = calculatePosition();

  if (speakers.length === 0) {
    console.log("[SpeakerSelectionMenu] No speakers, not rendering");
    return null; // Don't render if no speakers
  }

  console.log("[SpeakerSelectionMenu] Rendering menu with", speakers.length, "speakers");

  return (
    <div
      className="z-50 min-w-[240px] rounded-md border bg-popover p-1.5 shadow-md"
      style={style}
    >
      <div className="mb-2 px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        Select Speaker
      </div>
      <div className="flex flex-col gap-1">
        {speakers.map((speaker, index) => (
          <button
            key={speaker.id}
            className={`flex items-center gap-3 rounded px-3 py-2.5 text-left text-sm transition-colors ${
              index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              selectSpeaker(index);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">
              {index + 1}
            </div>
            <div
              className="h-3 w-3 shrink-0 rounded-full border-2 border-background"
              style={{ backgroundColor: speaker.color }}
            />
            <span className="flex-1 font-medium">{speaker.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 px-2 py-1 text-[10px] text-muted-foreground">
        Press 1-4 or use arrow keys
      </div>
    </div>
  );
});

SpeakerSelectionMenu.displayName = "SpeakerSelectionMenu";
