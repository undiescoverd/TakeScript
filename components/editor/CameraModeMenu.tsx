"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { CameraMode, cameraModeLabels } from "@/lib/tiptap/speaker-mark";

export interface CameraModeMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface CameraModeMenuProps {
  onSelect: (cameraMode: CameraMode | null) => void;
  clientRect?: (() => DOMRect | null) | null;
}

const cameraModes: (CameraMode | null)[] = ["full", "voiceover", "corner", null];
const cameraModeDisplayNames: Record<string, string> = {
  full: "Full Screen",
  voiceover: "Voiceover",
  corner: "Corner",
  none: "None",
};

export const CameraModeMenu = forwardRef<
  CameraModeMenuRef,
  CameraModeMenuProps
>(({ onSelect, clientRect }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectMode = useCallback(
    (index: number) => {
      const mode = cameraModes[index];
      onSelect(mode);
    },
    [onSelect]
  );

  // Expose keyboard handler to parent via ref
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      // Number keys 1-4
      if (event.key >= "1" && event.key <= "3") {
        const index = parseInt(event.key) - 1;
        if (index < cameraModes.length - 1) {
          // 1-3 map to full, voiceover, corner
          selectMode(index);
          return true;
        }
      }

      // Press 4 or N for None
      if (event.key === "4" || event.key.toLowerCase() === "n") {
        selectMode(3); // None is at index 3
        return true;
      }

      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : cameraModes.length - 1));
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev < cameraModes.length - 1 ? prev + 1 : 0));
        return true;
      }

      if (event.key === "Enter") {
        selectMode(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  // Calculate position from clientRect with dynamic positioning
  const rect = clientRect?.();

  const calculatePosition = () => {
    if (!rect) return { display: "none" as const };

    const MENU_MAX_HEIGHT = 220;
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

  return (
    <div
      className="z-50 min-w-[240px] rounded-md border bg-popover p-1.5 shadow-md"
      style={style}
    >
      <div className="mb-2 px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        Camera View
      </div>
      <div className="flex flex-col gap-1">
        {cameraModes.map((mode, index) => {
          const displayName = mode ? cameraModeDisplayNames[mode] : cameraModeDisplayNames.none;
          const numberKey = index < 3 ? index + 1 : 4;

          return (
            <button
              key={mode || "none"}
              className={`flex items-center gap-3 rounded px-3 py-2.5 text-left text-sm transition-colors ${
                index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectMode(index);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground">
                {numberKey}
              </div>
              <span className="flex-1 font-medium">{displayName}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 px-2 py-1 text-[10px] text-muted-foreground">
        Press 1-4 or use arrow keys
      </div>
    </div>
  );
});

CameraModeMenu.displayName = "CameraModeMenu";
