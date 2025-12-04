"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useCallback, useState, useEffect, useRef } from "react";
import { JSONContent, Editor } from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorStore } from "@/store/editor-store";
import { ScriptEditor } from "@/components/editor/ScriptEditor";
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor";
import { BeatBoard } from "@/components/editor/BeatBoard";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { VersionHistory } from "@/components/versions/VersionHistory";
import { CommentsPanel } from "@/components/comments/CommentsPanel";
import { AnnotationsPanel } from "@/components/annotations/AnnotationsPanel";

export default function ScriptPage() {
  const params = useParams();
  const router = useRouter();
  const scriptId = params.id as Id<"scripts">;
  const script = useQuery(api.scripts.get, { scriptId });
  const { scheduleAutosave, saveNow, setOnSaveComplete, getLastSavedContent } = useAutosave(scriptId);
  const { mode, commentsOpen, setCommentsOpen, annotationsOpen, setAnnotationsOpen, collaborationEnabled } = useEditorStore();
  const [editorRef, setEditorRef] = useState<Editor | null>(null);
  const [localContent, setLocalContent] = useState<JSONContent | null>(null);
  const contentInitialized = useRef(false);
  const isRestoringVersionRef = useRef(false);

  // Track when save completes - we use getLastSavedContent() to compare instead
  useEffect(() => {
    setOnSaveComplete(() => {
      // Save completed - getLastSavedContent() will return the saved content
      // so we can compare it in the script.content effect
    });
    return () => setOnSaveComplete(null);
  }, [setOnSaveComplete]);

  // Initialize local content from script
  // This effect syncs external state (Convex query) to local state, which is a valid use case
  useEffect(() => {
    if (script?.content && !contentInitialized.current) {
      try {
        const parsed = JSON.parse(script.content);
        // Syncing external state to local state - this is intentional
        setLocalContent(parsed);
        contentInitialized.current = true;
      } catch {
        // Syncing external state to local state - this is intentional
        setLocalContent({ type: "doc", content: [] });
        contentInitialized.current = true;
      }
    }
  }, [script?.content]);

  // Update local content when script changes (e.g., version restore)
  // BUT only if it's different from what we last saved (to avoid feedback loop)
  // This effect syncs external state (Convex query) to local state, which is a valid use case
  useEffect(() => {
    if (script?.content && contentInitialized.current) {
      try {
        const lastSaved = getLastSavedContent();
        
        // Deep comparison helper to handle JSON key ordering differences
        const contentEqual = (a: string, b: string | null): boolean => {
          if (!b) return false;
          if (a === b) return true;
          try {
            const parsedA = JSON.parse(a);
            const parsedB = JSON.parse(b);
            return JSON.stringify(parsedA) === JSON.stringify(parsedB);
          } catch {
            return a === b;
          }
        };
        
        // Skip update if this is the same content we just saved (autosave feedback loop)
        if (contentEqual(script.content, lastSaved) && !isRestoringVersionRef.current) {
          return;
        }
        
        // This is a real external change (version restore, etc.)
        const parsed = JSON.parse(script.content);
        // Syncing external state to local state - this is intentional
        setLocalContent(parsed);
        isRestoringVersionRef.current = false;
      } catch {
        // ignore parse errors
      }
    }
  }, [script?.content, getLastSavedContent]);

  const handleContentUpdate = useCallback(
    (content: string) => {
      try {
        const parsed = JSON.parse(content);
        setLocalContent(parsed);
        scheduleAutosave(content);
      } catch {
        // ignore parse errors
      }
    },
    [scheduleAutosave]
  );

  // Mark version restore when it happens (version restore will set this before calling restore)
  // This is handled by checking if content differs from last saved

  const handleSaveNow = useCallback(async () => {
    if (localContent) {
      await saveNow(JSON.stringify(localContent));
    }
  }, [localContent, saveNow]);

  const handleChapterClick = useCallback(
    (chapterId: string) => {
      // Scroll to chapter in editor
      const element = document.querySelector(`[data-id="${chapterId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    []
  );

  // Save on navigation away
  useEffect(() => {
    return () => {
      // Save any pending changes when component unmounts (navigation)
      if (localContent) {
        saveNow(JSON.stringify(localContent)).catch((error) => {
          console.error("Failed to save on navigation:", error);
        });
      }
    };
  }, [localContent, saveNow]);

  // Loading state
  if (script === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading script...
        </div>
      </div>
    );
  }

  // Not found state
  if (script === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Script not found</h1>
        <p className="text-muted-foreground text-center max-w-md">
          This script may not exist, or you may not have permission to view it.
          Make sure you're signed in and that the link is correct.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-primary underline"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // Wait for content to be initialized
  if (!localContent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background" data-mode={mode}>
      {/* Topbar */}
      <Topbar
        scriptId={scriptId}
        title={script.title}
        content={localContent}
        onSaveNow={handleSaveNow}
      />

      {/* Beat Board */}
      <BeatBoard content={localContent} onChapterClick={handleChapterClick} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar content={localContent} onChapterClick={handleChapterClick} />

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          {collaborationEnabled ? (
            <CollaborativeEditor
              scriptId={scriptId}
              onEditorReady={setEditorRef}
            />
          ) : (
            <ScriptEditor
              initialContent={localContent}
              onUpdate={handleContentUpdate}
              onEditorReady={setEditorRef}
              scriptId={scriptId}
            />
          )}
        </div>

        {/* Version History */}
        <VersionHistory scriptId={scriptId} />

        {/* Comments Panel */}
        <CommentsPanel
          scriptId={scriptId}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />

        {/* Annotations Panel */}
        <AnnotationsPanel
          scriptId={scriptId}
          isOpen={annotationsOpen}
          onClose={() => setAnnotationsOpen(false)}
          editor={editorRef}
        />
      </div>
    </div>
  );
}
