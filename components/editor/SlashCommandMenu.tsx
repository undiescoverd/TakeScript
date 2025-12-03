"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import { generateBlockId } from "@/lib/utils";

interface Command {
  name: string;
  description: string;
  icon: string;
  action: (editor: Editor) => void;
}

const commands: Command[] = [
  {
    name: "Chapter",
    description: "Add a chapter heading",
    icon: "📑",
    action: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "chapter",
          attrs: {
            title: "New Chapter",
            id: generateBlockId("chapter"),
          },
        })
        .run();
    },
  },
  {
    name: "Screen Recording",
    description: "Add a screen recording section",
    icon: "🖥️",
    action: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "screenRecording",
          attrs: { id: generateBlockId("screenRecording") },
          content: [{ type: "text", text: "Describe screen recording..." }],
        })
        .run();
    },
  },
  {
    name: "Demonstration",
    description: "Add a demonstration section",
    icon: "🎬",
    action: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "demonstration",
          attrs: { id: generateBlockId("demonstration") },
          content: [{ type: "text", text: "Describe demonstration..." }],
        })
        .run();
    },
  },
  {
    name: "Editor Note",
    description: "Add an editor note (hidden in recording mode)",
    icon: "📝",
    action: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "editorNote",
          attrs: { id: generateBlockId("editorNote") },
          content: [{ type: "text", text: "Editor note..." }],
        })
        .run();
    },
  },
  {
    name: "Heading 1",
    description: "Large heading",
    icon: "H1",
    action: (editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
  },
  {
    name: "Heading 2",
    description: "Medium heading",
    icon: "H2",
    action: (editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
  },
  {
    name: "Bullet List",
    description: "Create a bullet list",
    icon: "•",
    action: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    name: "Numbered List",
    description: "Create a numbered list",
    icon: "1.",
    action: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    name: "Quote",
    description: "Add a quote block",
    icon: "❝",
    action: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    name: "Paragraph",
    description: "Plain text paragraph",
    icon: "¶",
    action: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
  },
];

interface SlashCommandMenuProps {
  editor: Editor | null;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [slashPosition, setSlashPosition] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(search.toLowerCase()) ||
      cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    setSlashPosition(null);
    setSelectedIndex(0);
  }, []);

  const executeCommand = useCallback(
    (command: Command) => {
      if (!editor || slashPosition === null) return;

      // Delete the slash and any search text that was typed
      const currentPos = editor.state.selection.from;
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashPosition, to: currentPos })
        .run();

      // Execute the command action
      command.action(editor);

      closeMenu();
    },
    [editor, slashPosition, closeMenu]
  );

  // Handle keyboard events when menu is open
  useEffect(() => {
    if (!editor || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) =>
            i < filteredCommands.length - 1 ? i + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) =>
            i > 0 ? i - 1 : filteredCommands.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeMenu();
          break;
        case "Backspace":
          // Let backspace go through to the editor but track it
          if (search.length === 0) {
            // If no search text, close menu (they deleted the slash)
            closeMenu();
          } else {
            setSearch((s) => s.slice(0, -1));
          }
          break;
        case " ":
          // Space without match should close menu and let space through
          if (filteredCommands.length === 0) {
            closeMenu();
          }
          break;
        default:
          // Track typed characters for filtering
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            setSearch((s) => s + e.key);
            setSelectedIndex(0);
          }
      }
    };

    // Use capture phase to intercept before editor
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, isOpen, search, selectedIndex, filteredCommands, executeCommand, closeMenu]);

  // Listen for "/" to open menu
  useEffect(() => {
    if (!editor) return;

    const handleSlash = (e: KeyboardEvent) => {
      if (isOpen) return;

      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        // Store position where slash will be inserted
        const { from } = editor.state.selection;

        // Get cursor position for menu placement
        const coords = editor.view.coordsAtPos(from);
        setPosition({ top: coords.bottom + 8, left: coords.left });

        // The slash will be inserted at `from`, so track that position
        setSlashPosition(from);
        setIsOpen(true);
        setSearch("");
        setSelectedIndex(0);
      }
    };

    document.addEventListener("keydown", handleSlash);
    return () => document.removeEventListener("keydown", handleSlash);
  }, [editor, isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, closeMenu]);

  // Close menu if editor loses focus or selection changes significantly
  useEffect(() => {
    if (!editor || !isOpen) return;

    const handleSelectionUpdate = () => {
      // If cursor moved before the slash position, close menu
      if (slashPosition !== null) {
        const { from } = editor.state.selection;
        if (from < slashPosition) {
          closeMenu();
        }
      }
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, isOpen, slashPosition, closeMenu]);

  if (!isOpen || !editor) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[220px] max-h-[300px] overflow-y-auto overflow-x-hidden rounded-lg border bg-popover p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {search && (
        <div className="px-3 py-1 text-xs text-muted-foreground border-b mb-1">
          Searching: {search}
        </div>
      )}
      {filteredCommands.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No commands found
        </div>
      ) : (
        filteredCommands.map((command, index) => (
          <button
            key={command.name}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
            }`}
            onClick={() => executeCommand(command)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="flex h-6 w-6 items-center justify-center text-base">
              {command.icon}
            </span>
            <div>
              <div className="font-medium">{command.name}</div>
              <div className="text-xs text-muted-foreground">
                {command.description}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
