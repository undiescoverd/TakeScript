"use client";

import { useEditor, EditorContent, JSONContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useState, useCallback } from "react";
import { useEditorStore } from "@/store/editor-store";
import { customExtensions } from "@/lib/tiptap/extensions";
import { SlashCommands } from "@/lib/tiptap/slash-commands";
import { createSlashCommandsRender } from "@/lib/tiptap/suggestion-render";
import { AnnotationMark } from "@/lib/tiptap/annotation-mark";
import { SpeakerMark, onSpeakerLabelClick, updateSpeakersInEditor } from "@/lib/tiptap/speaker-mark";
import { SelectionToolbar } from "@/components/editor/SelectionToolbar";
import { SpeakerEditDialog } from "@/components/editor/SpeakerEditDialog";
import { Id } from "@/convex/_generated/dataModel";
import { useSpeakerStore } from "@/store/speaker-store";
import { toast } from "sonner";

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

  // Get speakers directly from store - no useShallow needed since we're doing our own comparison
  const speakers = useSpeakerStore((state) => state.speakers);

  // Track the last speakers we sent to the editor to prevent unnecessary updates
  const lastSpeakersRef = useRef<string>("");

  // Speaker edit dialog state
  const [selectedSpeaker, setSelectedSpeaker] = useState<{
    speakerId: string;
    position: number;
    faceVisible: boolean;
  } | null>(null);

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
      Underline,
      ...customExtensions,
      AnnotationMark,
      SpeakerMark,
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
    onCreate: ({ editor }) => {
      console.log("[ScriptEditor] Editor created successfully");
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

  // Set up speaker label click handler (uses event delegation in ProseMirror plugin)
  useEffect(() => {
    if (!editor) return;

    onSpeakerLabelClick((speakerId, position, faceVisible) => {
      setSelectedSpeaker({ speakerId, position, faceVisible });
    });

    return () => {
      onSpeakerLabelClick(null);
    };
  }, [editor]);

  // SINGLE unified effect for syncing speakers to the editor plugin
  // This replaces the previous two-effect approach that caused race conditions
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Serialize for comparison to prevent unnecessary updates
    const speakersKey = JSON.stringify(
      speakers.map(s => ({ id: s.id, name: s.name, color: s.color, faceVisible: s.faceVisible }))
    );

    // Skip if speakers haven't actually changed
    if (speakersKey === lastSpeakersRef.current) {
      return;
    }

    lastSpeakersRef.current = speakersKey;

    // Update the editor plugin state directly with the speakers array
    // This is atomic - the speakers are passed directly to decoration creation
    updateSpeakersInEditor(editor, speakers);
  }, [editor, speakers]);

  // Set up callback to remove speaker marks when a speaker is deleted
  useEffect(() => {
    if (!editor) return;

    const setOnSpeakerDeleted = useSpeakerStore.getState().setOnSpeakerDeleted;

    setOnSpeakerDeleted((deletedSpeakerId: string) => {
      const { doc, tr } = editor.state;
      const speakerMarkType = editor.schema.marks.speaker;
      let transaction = tr;

      doc.descendants((node, pos) => {
        if (node.isText && node.marks.length > 0) {
          node.marks.forEach((mark) => {
            if (mark.type === speakerMarkType && mark.attrs.speakerId === deletedSpeakerId) {
              const from = pos;
              const to = pos + node.nodeSize;
              transaction = transaction.removeMark(from, to, speakerMarkType);
            }
          });
        }
      });

      if (transaction.docChanged) {
        editor.view.dispatch(transaction);
      }
    });

    return () => {
      useSpeakerStore.getState().setOnSpeakerDeleted(() => {});
    };
  }, [editor]);

  // Helper function to get speaker mark at current selection
  const getSpeakerAtSelection = useCallback((editor: Editor): string | null => {
    const { from, to } = editor.state.selection;
    const speakerMarkType = editor.schema.marks.speaker;
    let speakerId: string | null = null;

    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && node.marks.length > 0) {
        const speakerMark = node.marks.find((m) => m.type === speakerMarkType);
        if (speakerMark) {
          speakerId = speakerMark.attrs.speakerId;
          return false;
        }
      }
    });

    return speakerId;
  }, []);

  // Keyboard shortcuts for speaker assignment (Cmd+1-4) and removal (Cmd+`)
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      // Handle Cmd+` (backtick) - Remove speaker
      if (isCmdOrCtrl && event.key === "`") {
        event.preventDefault();

        const { from, to } = editor.state.selection;
        if (from === to) {
          toast.error("Please select text first");
          return;
        }

        const currentSpeakerId = getSpeakerAtSelection(editor);
        if (!currentSpeakerId) {
          toast.info("No speaker assigned to this selection");
          return;
        }

        const speaker = speakers.find((s) => s.id === currentSpeakerId);
        editor.chain().focus().setTextSelection({ from, to }).unsetSpeaker().run();
        toast.success(`Removed ${speaker?.name || "speaker"}`);
        return;
      }

      // Handle Cmd+1 through Cmd+4 - Toggle/Swap speaker
      const number = parseInt(event.key);
      if (isCmdOrCtrl && number >= 1 && number <= 4) {
        event.preventDefault();

        const { from, to } = editor.state.selection;
        if (from === to) {
          toast.error("Please select some text first");
          return;
        }

        const speaker = speakers[number - 1];
        if (!speaker) {
          toast.error(`No speaker assigned to Cmd+${number}`);
          return;
        }

        const currentSpeakerId = getSpeakerAtSelection(editor);

        if (!currentSpeakerId) {
          editor.chain().focus().setTextSelection({ from, to }).setSpeaker(speaker.id).run();
          toast.success(`Assigned to ${speaker.name}`);
        } else if (currentSpeakerId === speaker.id) {
          editor.chain().focus().setTextSelection({ from, to }).unsetSpeaker().run();
          toast.success(`Removed ${speaker.name}`);
        } else {
          const previousSpeaker = speakers.find((s) => s.id === currentSpeakerId);
          editor.chain().focus().setTextSelection({ from, to }).setSpeaker(speaker.id).run();
          toast.success(`Changed from ${previousSpeaker?.name || "Unknown"} to ${speaker.name}`);
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, speakers, getSpeakerAtSelection]);

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
    console.log("[ScriptEditor] Waiting for editor to initialize...");
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading editor...
        </div>
      </div>
    );
  }

  console.log("[ScriptEditor] Editor initialized successfully, rendering content");

  return (
    <div className="relative h-full overflow-auto bg-background" data-mode={mode}>
      <EditorContent editor={editor} />
      <SelectionToolbar editor={editor} scriptId={scriptId} />

      {/* Speaker Edit Dialog */}
      {selectedSpeaker && (
        <SpeakerEditDialog
          editor={editor}
          speakerId={selectedSpeaker.speakerId}
          position={selectedSpeaker.position}
          open={!!selectedSpeaker}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSpeaker(null);
            }
          }}
        />
      )}
    </div>
  );
}

export { useEditor };
