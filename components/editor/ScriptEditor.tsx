"use client";

import { useEditor, EditorContent, JSONContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { customExtensions } from "@/lib/tiptap/extensions";
import { SlashCommands } from "@/lib/tiptap/slash-commands";
import { createSlashCommandsRender } from "@/lib/tiptap/suggestion-render";
import { AnnotationMark } from "@/lib/tiptap/annotation-mark";
import { SpeakerMark } from "@/lib/tiptap/speaker-mark";
import { setupSpeakerPillObserver, setPillClickHandler, applySpeakerColors, renderSpeakerPills } from "@/lib/tiptap/speaker-pill-renderer";
import { SelectionToolbar } from "@/components/editor/SelectionToolbar";
import { SpeakerPillPopover } from "@/components/editor/SpeakerPillPopover";
import { Popover } from "@/components/ui/popover";
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
  const speakers = useSpeakerStore((state) => state.speakers);

  // Speaker pill popover state - single state to avoid batching issues
  const [selectedPill, setSelectedPill] = useState<{
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
      Underline, // Explicitly add Underline (not in StarterKit by default)
      ...customExtensions,
      AnnotationMark,
      SpeakerMark, // SpeakerMark includes its own ProseMirror plugins for pill rendering
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
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [editor, editorError]);

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

  // Set up speaker pill observer and click handler
  useEffect(() => {
    if (!editor) return;

    let isHandlingClick = false;

    // Set up click handler for speaker pills
    console.log("Setting up pill click handler");
    setPillClickHandler((speakerId, position, faceVisible) => {
      console.log("Pill click handler called:", { speakerId, position, faceVisible });

      // Prevent duplicate calls
      if (isHandlingClick) {
        console.log("Ignoring duplicate handler call");
        return;
      }

      isHandlingClick = true;

      // Use requestAnimationFrame to ensure state update happens in next frame
      requestAnimationFrame(() => {
        setSelectedPill({ speakerId, position, faceVisible });

        // Reset after dialog opens
        setTimeout(() => {
          isHandlingClick = false;
        }, 500);
      });
    });

    const editorElement = editor.view.dom as HTMLElement;
    const observer = setupSpeakerPillObserver(editorElement);

    // Hook into editor updates to ensure colors are applied on every content change
    const updateHandler = () => {
      // Use double requestAnimationFrame to ensure DOM has fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applySpeakerColors(editorElement);
        });
      });
    };

    editor.on("update", updateHandler);
    editor.on("selectionUpdate", updateHandler);
    
    // Also apply colors immediately when editor is ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applySpeakerColors(editorElement);
      });
    });

    return () => {
      observer.disconnect();
      editor.off("update", updateHandler);
      editor.off("selectionUpdate", updateHandler);
      setPillClickHandler(() => {});
    };
  }, [editor]);

  // Set up callback to remove speaker marks when a speaker is deleted
  useEffect(() => {
    if (!editor) return;

    const setOnSpeakerDeleted = useSpeakerStore.getState().setOnSpeakerDeleted;

    setOnSpeakerDeleted((deletedSpeakerId: string) => {
      // Remove all speaker marks with this speakerId
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
      // Clean up callback on unmount
      useSpeakerStore.getState().setOnSpeakerDeleted(() => {});
    };
  }, [editor]);

  // Re-render speaker pills when speakers change (e.g., when a speaker is deleted or updated)
  useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom as HTMLElement;
    // Force re-render to update all pills with latest speaker data
    renderSpeakerPills(editorElement, true);
  }, [editor, speakers]);

  // Keyboard shortcuts for quick speaker assignment (Cmd+1 through Cmd+4)
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+1 through Cmd+4 (or Ctrl on Windows/Linux)
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      const number = parseInt(event.key);

      if (isCmdOrCtrl && number >= 1 && number <= 4) {
        event.preventDefault();

        // Check if there's a selection
        const { from, to } = editor.state.selection;
        if (from === to) {
          toast.error("Please select some text first");
          return;
        }

        // Get the speaker at the specified index (0-3)
        const speaker = speakers[number - 1];
        if (!speaker) {
          toast.error(`No speaker assigned to Cmd+${number}`);
          return;
        }

        // Apply the speaker mark
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .setSpeaker(speaker.id)
          .run();

        toast.success(`Assigned to ${speaker.name}`);
      }
    };

    // Add event listener to the editor's DOM element
    const editorElement = editor.view.dom;
    editorElement.addEventListener("keydown", handleKeyDown);

    return () => {
      editorElement.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, speakers]);

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

      {/* Speaker Pill Popover - Using modal mode since we don't have a React trigger element */}
      {selectedPill && (
        <SpeakerPillPopover
          editor={editor}
          speakerId={selectedPill.speakerId}
          position={selectedPill.position}
          open={!!selectedPill}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPill(null);
            }
          }}
        />
      )}
    </div>
  );
}

export { useEditor };
