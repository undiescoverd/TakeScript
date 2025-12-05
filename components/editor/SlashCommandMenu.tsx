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

  // Calculate position from clientRect
  const rect = clientRect?.();
  const style = rect
    ? {
        position: "fixed" as const,
        top: rect.bottom + 8,
        left: rect.left,
        zIndex: 9999,
      }
    : { display: "none" as const };

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
