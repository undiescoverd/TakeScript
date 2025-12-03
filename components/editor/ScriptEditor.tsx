"use client";

import { useEditor, EditorContent, JSONContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";
import { customExtensions } from "@/lib/tiptap/extensions";

interface ScriptEditorProps {
  initialContent: JSONContent;
  onUpdate: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function ScriptEditor({
  initialContent,
  onUpdate,
  onEditorReady,
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
        placeholder: "Type '/' for commands...",
      }),
      ...customExtensions,
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
  useEffect(() => {
    if (editor && !isFirstRender.current) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(initialContent);
      if (currentContent !== newContent) {
        editor.commands.setContent(initialContent);
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

  // Handle slash command
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "/" && editor) {
        // Show slash command menu
        // This is handled by the SlashCommandMenu component
      }
    },
    [editor]
  );

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
    <div
      className="h-full overflow-auto bg-background"
      data-mode={mode}
      onKeyDown={handleKeyDown}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

export { useEditor };
