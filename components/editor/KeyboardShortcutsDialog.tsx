"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: Shortcut[];
}

function isMac(): boolean {
  if (typeof window === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) || 
         /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent);
}

function formatKey(key: string, isMac: boolean): string {
  if (key === "Mod") {
    return isMac ? "⌘" : "Ctrl";
  }
  if (key === "Shift") {
    return isMac ? "⇧" : "Shift";
  }
  if (key === "/") return "/";
  return key.toUpperCase();
}

function formatShortcut(shortcut: string, isMac: boolean): string[] {
  const parts = shortcut.split("-");
  return parts.map((part) => formatKey(part, isMac));
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const [isMacPlatform, setIsMacPlatform] = useState(false);

  useEffect(() => {
    setIsMacPlatform(isMac());
  }, []);

  const categories: ShortcutCategory[] = [
    {
      title: "Speaker Shortcuts",
      shortcuts: [
        {
          keys: formatShortcut("Mod-9", isMacPlatform),
          description: "Cycle through speakers (or set pending for next typed text)",
        },
        {
          keys: formatShortcut("Mod-0", isMacPlatform),
          description: "Cycle camera mode (full → voiceover → corner → none)",
        },
        {
          keys: formatShortcut("Mod-J", isMacPlatform),
          description: "Remove speaker from selection or clear pending",
        },
      ],
    },
    {
      title: "Editor Shortcuts",
      shortcuts: [
        {
          keys: formatShortcut("Mod-K", isMacPlatform),
          description: "Open slash command menu",
        },
      ],
    },
    {
      title: "General Shortcuts",
      shortcuts: [
        {
          keys: formatShortcut("Mod-/", isMacPlatform),
          description: "Open keyboard shortcuts",
        },
        {
          keys: formatShortcut("Mod-Shift-F", isMacPlatform),
          description: "Toggle Focus Mode",
        },
        {
          keys: formatShortcut("Mod-S", isMacPlatform),
          description: "Save version",
        },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick reference for all available keyboard shortcuts
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {categories.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold mb-3 text-foreground">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-4 py-2"
                  >
                    <span className="text-sm text-muted-foreground flex-1">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs px-2 py-0.5 h-6 min-w-[2rem] justify-center font-medium"
                          >
                            {key}
                          </Badge>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
