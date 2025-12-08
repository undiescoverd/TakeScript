"use client";

import { useEditor, EditorContent, JSONContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";
import { customExtensions } from "@/lib/tiptap/extensions";
import { SlashCommands } from "@/lib/tiptap/slash-commands";
import { createSlashCommandsRender } from "@/lib/tiptap/suggestion-render";
import { AnnotationMark } from "@/lib/tiptap/annotation-mark";
import { SelectionToolbar } from "@/components/editor/SelectionToolbar";
import { Id } from "@/convex/_generated/dataModel";

interface ScriptEditorProps {
  initialContent: JSONContent;
  onUpdate: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
  scriptId: Id<"scripts">;
}

export function ScriptEditor({
  initialContent,
  onUpdate,
  onEditorReady,
  scriptId,
}: ScriptEditorProps) {
  const { mode } = useEditorStore();
  const isFirstRender = useRef(true);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands or select text for formatting...",
      }),
      Highlight,
      Underline,
      ...customExtensions,
      AnnotationMark,
      SlashCommands.configure({
        suggestion: {
          render: createSlashCommandsRender,
        },
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "ProseMirror",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onUpdate(JSON.stringify(json));
    },
  });

  // Update editor content when initialContent changes (e.g., version restore)
  // BUT only if editor is not currently focused/being edited to avoid interrupting user
  useEffect(() => {
    if (editor && !isFirstRender.current) {
      const currentContent = editor.getJSON();
      const newContent = initialContent;
      
      // Deep comparison helper
      const deepEqual = (a: any, b: any): boolean => {
        if (a === b) return true;
        if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
          return false;
        }
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        for (const key of keysA) {
          if (!keysB.includes(key)) return false;
          if (!deepEqual(a[key], b[key])) return false;
        }
        return true;
      };
      
      // Only update if content is actually different AND editor is not focused
      // This prevents interrupting user edits when autosave completes
      if (!deepEqual(currentContent, newContent) && !editor.isFocused) {
        editor.commands.setContent(initialContent, { emitUpdate: false });
      }
    }
    isFirstRender.current = false;
  }, [editor, initialContent]);

  // Notify parent component when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-background" data-mode={mode}>
      <EditorContent editor={editor} />
      <SelectionToolbar editor={editor} scriptId={scriptId} />
    </div>
  );
}

export { useEditor };
