"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { customExtensions } from "@/lib/tiptap/extensions";
import { SlashCommands } from "@/lib/tiptap/slash-commands";
import { createSlashCommandsRender } from "@/lib/tiptap/suggestion-render";
import { AnnotationMark } from "@/lib/tiptap/annotation-mark";
import { AnnotationBubble } from "@/components/annotations/AnnotationBubble";
import { Id } from "@/convex/_generated/dataModel";
import { useCollaboration } from "@/hooks/use-collaboration";
import { Collaborators } from "@/components/collaboration/Collaborators";
import type { HocuspocusProvider } from "@hocuspocus/provider";

interface CollaborativeEditorProps {
  scriptId: Id<"scripts">;
  onEditorReady?: (editor: Editor) => void;
}

export function CollaborativeEditor({
  scriptId,
  onEditorReady,
}: CollaborativeEditorProps) {
  const { mode } = useEditorStore();

  // Initialize collaboration
  const {
    provider,
    ydoc,
    isSynced,
    collaborators,
    currentUser,
    connectionStatus,
  } = useCollaboration({
    documentId: scriptId,
    enabled: true,
  });

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          // Disable history since Collaboration provides its own
          history: false,
        }),
        Placeholder.configure({
          placeholder: "Type '/' for commands...",
        }),
        ...customExtensions,
        AnnotationMark,
        SlashCommands.configure({
          suggestion: {
            render: createSlashCommandsRender,
          },
        }),
        // Only add Collaboration extensions when we have ydoc and currentUser
        ...(ydoc && currentUser
          ? [
              // Collaboration extension - syncs document
              Collaboration.configure({
                document: ydoc,
              }),
              // TODO: Re-enable CollaborationCursor after fixing version mismatch
              // Temporarily disabled due to version compatibility issues
              // ...(provider
              //   ? [
              //       CollaborationCursor.configure({
              //         provider: provider as unknown as HocuspocusProvider,
              //         user: {
              //           name: currentUser.name,
              //           color: currentUser.color,
              //         },
              //       }),
              //     ]
              //   : []),
            ]
          : []),
      ],
      editorProps: {
        attributes: {
          class: "ProseMirror",
        },
      },
    },
    [ydoc, provider, currentUser] // Reinitialize when these change
  );

  // Notify parent component when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // TODO: Re-enable when CollaborationCursor is re-enabled
  // Update cursor info when user changes
  // useEffect(() => {
  //   if (editor && currentUser) {
  //     editor.commands.updateUser({
  //       name: currentUser.name,
  //       color: currentUser.color,
  //     });
  //   }
  // }, [editor, currentUser]);

  // Wait for user to be loaded before rendering
  if (!currentUser) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading collaboration...
        </div>
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
    <div className="h-full overflow-auto bg-background" data-mode={mode}>
      {/* Collaboration status bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {connectionStatus === "connected"
              ? isSynced
                ? "Synced"
                : "Syncing..."
              : connectionStatus === "connecting"
                ? "Connecting..."
                : "Offline"}
          </span>
        </div>

        {/* Active collaborators */}
        <Collaborators
          collaborators={collaborators}
          currentUser={currentUser}
        />
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
      <AnnotationBubble editor={editor} scriptId={scriptId} />
    </div>
  );
}
