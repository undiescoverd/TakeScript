"use client";

import { useEditor, EditorContent, JSONContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useEditorStore } from "@/store/editor-store";
import { useSpeakerStore, Speaker } from "@/store/speaker-store";
import { customExtensions, SpeakerMark } from "@/lib/tiptap/extensions";
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
  const { mode, setAnnotationsOpen, setSelectedAnnotationId } = useEditorStore();
  const { speakers } = useSpeakerStore();
  const isFirstRender = useRef(true);

  // Create a stable reference to getSpeakers that the extension can use
  const speakersRef = useRef<Speaker[]>(speakers);
  useEffect(() => {
    speakersRef.current = speakers;
  }, [speakers]);

  const getSpeakers = useMemo(() => () => speakersRef.current, []);

  // Handler for annotation clicks
  const handleAnnotationClick = useCallback(
    (annotationId: string) => {
      setSelectedAnnotationId(annotationId);
      setAnnotationsOpen(true);
    },
    [setSelectedAnnotationId, setAnnotationsOpen]
  );

  const [editorError, setEditorError] = useState<Error | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);

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
      ...customExtensions,
      AnnotationMark.configure({
        onAnnotationClick: handleAnnotationClick,
      }),
      SpeakerMark.configure({
        getSpeakers,
      }),
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
      try {
        const json = editor.getJSON();
        onUpdate(JSON.stringify(json));
      } catch (error) {
        console.error("[ScriptEditor] Error during update:", error);
        setEditorError(error as Error);
      }
    },
  });

  // Timeout detection - if editor doesn't initialize in 10 seconds, show error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!editor && !editorError) {
        console.error("[ScriptEditor] Editor initialization timed out after 10 seconds");
        setIsTimedOut(true);
        setEditorError(new Error("Editor initialization timed out. The document may be too large or contain problematic content."));
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [editor, editorError]);

  // Force decoration recalculation when speakers change
  useEffect(() => {
    if (editor && speakers.length > 0) {
      // Trigger a transaction to force decoration update
      editor.view.dispatch(editor.state.tr.setMeta("speakersUpdated", true));
    }
  }, [editor, speakers]);

  // Update editor content when initialContent changes (e.g., version restore)
  useEffect(() => {
    if (editor && !isFirstRender.current) {
      const currentContent = editor.getJSON();
      const newContent = initialContent;

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

      // Apply even while the editor is focused: the parent only changes
      // initialContent for genuine external updates (e.g. version restore),
      // and skipping here would let the next keystroke autosave the stale doc.
      if (!deepEqual(currentContent, newContent)) {
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

  // Show error state if editor failed to initialize
  if (editorError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <div className="text-destructive text-xl font-semibold">Editor Failed to Load</div>
        <div className="text-muted-foreground text-center max-w-md">
          {editorError.message || "The editor encountered an error during initialization."}
        </div>
        <div className="text-sm text-muted-foreground">
          This may be caused by corrupted content or invalid document structure.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Reload Page
        </button>
        <a
          href="/diagnostics"
          className="text-primary underline text-sm"
        >
          Go to Diagnostics
        </a>
      </div>
    );
  }

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
