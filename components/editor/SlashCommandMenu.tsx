"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { SlashCommandItem } from "@/lib/tiptap/slash-commands";

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect?: (() => DOMRect | null) | null;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(({ items, command, clientRect }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [command, items]
  );

  // Expose keyboard handler to parent via ref
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        return true;
      }

      if (event.key === "Enter") {
        selectItem(selectedIndex);
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

    const MENU_MAX_HEIGHT = 320; // matches max-h-[320px] in className
    const MENU_WIDTH = 220; // approximate width based on min-w-[220px]
    const SPACING = 8; // gap between cursor and menu

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Calculate available space below and above the cursor
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Determine vertical position
    let top: number;
    if (spaceBelow >= MENU_MAX_HEIGHT + SPACING) {
      // Enough space below - position below cursor
      top = rect.bottom + SPACING;
    } else if (spaceAbove >= MENU_MAX_HEIGHT + SPACING) {
      // Not enough space below, but enough above - position above cursor
      top = rect.top - MENU_MAX_HEIGHT - SPACING;
    } else if (spaceBelow >= spaceAbove) {
      // Limited space both sides, but more below - position below with max available height
      top = rect.bottom + SPACING;
    } else {
      // More space above - position above with max available height
      top = Math.max(SPACING, rect.top - MENU_MAX_HEIGHT - SPACING);
    }

    // Determine horizontal position (prevent overflow on right edge)
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

  if (items.length === 0) {
    return (
      <div
        className="z-50 min-w-[220px] rounded-lg border bg-popover p-2 shadow-lg"
        style={style}
      >
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No commands found
        </div>
      </div>
    );
  }

  return (
    <div
      className="z-50 min-w-[200px] max-h-[320px] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 shadow-md"
      style={style}
    >
      {items.map((item, index) => (
        <button
          key={item.name}
          className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors ${
            index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            selectItem(index);
          }}
          onMouseEnter={() => setSelectedIndex(index)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-medium text-muted-foreground">
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-normal">{item.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = "SlashCommandMenu";
