"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { JSONContent, Editor } from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorStore } from "@/store/editor-store";
import { ScriptEditor } from "@/components/editor/ScriptEditor";
import { SlashCommandMenu } from "@/components/editor/SlashCommandMenu";
import { BeatBoard } from "@/components/editor/BeatBoard";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { VersionHistory } from "@/components/versions/VersionHistory";
import { CommentsPanel } from "@/components/comments/CommentsPanel";

export default function ScriptPage() {
  const params = useParams();
  const router = useRouter();
  const scriptId = params.id as Id<"scripts">;
  const script = useQuery(api.scripts.get, { scriptId });
  const { scheduleAutosave, saveNow } = useAutosave(scriptId);
  const { mode, commentsOpen, setCommentsOpen } = useEditorStore();
  const [editorRef, setEditorRef] = useState<Editor | null>(null);
  const [localContent, setLocalContent] = useState<JSONContent | null>(null);
  const contentInitialized = useRef(false);

  // Initialize local content from script
  useEffect(() => {
    if (script && !contentInitialized.current) {
      try {
        const parsed = JSON.parse(script.content);
        setLocalContent(parsed);
        contentInitialized.current = true;
      } catch {
        setLocalContent({ type: "doc", content: [] });
        contentInitialized.current = true;
      }
    }
  }, [script]);

  // Update local content when script changes (e.g., version restore)
  useEffect(() => {
    if (script && contentInitialized.current) {
      try {
        const parsed = JSON.parse(script.content);
        setLocalContent(parsed);
      } catch {
        // ignore parse errors
      }
    }
  }, [script?.content]);

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
        <button
          onClick={() => router.push("/dashboard")}
          className="text-primary underline"
        >
          Back to dashboard
        </button>
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
          <ScriptEditor
            initialContent={localContent}
            onUpdate={handleContentUpdate}
            onEditorReady={setEditorRef}
          />
        </div>

        {/* Slash Command Menu */}
        <SlashCommandMenu editor={editorRef} />

        {/* Version History */}
        <VersionHistory scriptId={scriptId} />

        {/* Comments Panel */}
        <CommentsPanel
          scriptId={scriptId}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      </div>
    </div>
  );
}
