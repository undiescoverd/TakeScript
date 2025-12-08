"use client";

import { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Highlighter,
  Sparkles,
  Maximize2,
  RefreshCw,
  FileText,
} from "lucide-react";
import { getFeatureFlags } from "@/lib/feature-flags";

interface SelectionToolbarProps {
  editor: Editor;
}

export function SelectionToolbar({ editor }: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const flags = getFeatureFlags();

  useEffect(() => {
    const updateToolbar = () => {
      const { selection } = editor.state;
      const { from, to } = selection;

      // Hide if no selection or cursor only
      if (from === to) {
        setIsVisible(false);
        return;
      }

      // Get the DOM position of the selection
      const { view } = editor;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      if (!start || !end) {
        setIsVisible(false);
        return;
      }

      // Calculate toolbar position (above selection, centered)
      const editorRect = view.dom.getBoundingClientRect();
      const toolbarWidth = 400; // Approximate width
      const toolbarHeight = 48; // Approximate height

      const left = (start.left + end.left) / 2 - toolbarWidth / 2;
      const top = start.top - toolbarHeight - 8; // 8px gap above selection

      setPosition({ top, left });
      setIsVisible(true);
    };

    // Update on selection change
    editor.on("selectionUpdate", updateToolbar);
    editor.on("update", updateToolbar);

    return () => {
      editor.off("selectionUpdate", updateToolbar);
      editor.off("update", updateToolbar);
    };
  }, [editor]);

  if (!isVisible) return null;

  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to);
  };

  const handleAICommand = (command: string) => {
    const selectedText = getSelectedText();
    const { from, to } = editor.state.selection;

    // Dispatch AI event with selection context
    window.dispatchEvent(
      new CustomEvent(`ai:${command}`, {
        detail: {
          editor,
          selectedText,
          selection: { from, to, text: selectedText, isEmpty: false },
        },
      })
    );
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Text Formatting */}
      <ToolbarButton
        icon={<Bold className="h-4 w-4" />}
        tooltip="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
      />
      <ToolbarButton
        icon={<Italic className="h-4 w-4" />}
        tooltip="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
      />
      <ToolbarButton
        icon={<Underline className="h-4 w-4" />}
        tooltip="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
      />
      <ToolbarButton
        icon={<Strikethrough className="h-4 w-4" />}
        tooltip="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
      />
      <ToolbarButton
        icon={<Highlighter className="h-4 w-4" />}
        tooltip="Highlight"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
      />

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Headings */}
      <ToolbarButton
        icon={<Heading1 className="h-4 w-4" />}
        tooltip="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
      />
      <ToolbarButton
        icon={<Heading2 className="h-4 w-4" />}
        tooltip="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
      />
      <ToolbarButton
        icon={<Heading3 className="h-4 w-4" />}
        tooltip="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
      />

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Lists & Blocks */}
      <ToolbarButton
        icon={<List className="h-4 w-4" />}
        tooltip="Bullet List"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
      />
      <ToolbarButton
        icon={<ListOrdered className="h-4 w-4" />}
        tooltip="Numbered List"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
      />
      <ToolbarButton
        icon={<Quote className="h-4 w-4" />}
        tooltip="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
      />
      <ToolbarButton
        icon={<Code className="h-4 w-4" />}
        tooltip="Code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
      />

      {/* AI Commands */}
      {flags.aiGenerationEnabled && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />

          <ToolbarButton
            icon={<Sparkles className="h-4 w-4" />}
            tooltip="AI Generate"
            onClick={() => handleAICommand("generate")}
          />
          <ToolbarButton
            icon={<Maximize2 className="h-4 w-4" />}
            tooltip="AI Expand"
            onClick={() => handleAICommand("expand")}
          />
          <ToolbarButton
            icon={<RefreshCw className="h-4 w-4" />}
            tooltip="AI Rephrase"
            onClick={() => handleAICommand("rephrase")}
          />
          <ToolbarButton
            icon={<FileText className="h-4 w-4" />}
            tooltip="AI Summarize"
            onClick={() => handleAICommand("summarize")}
          />
        </>
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  isActive?: boolean;
}

function ToolbarButton({ icon, tooltip, onClick, isActive }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded p-1.5 transition-colors hover:bg-accent ${
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      }`}
      title={tooltip}
    >
      {icon}
    </button>
  );
}
