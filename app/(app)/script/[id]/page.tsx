"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useAction, useMutation } from "convex/react";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { JSONContent, Editor } from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAutosave } from "@/hooks/use-autosave";
import { useApplySuggestions } from "@/hooks/use-apply-suggestions";
import { useFocusChromeReveal } from "@/hooks/use-focus-chrome-reveal";
import { useEditorStore } from "@/store/editor-store";
import { ScriptEditor } from "@/components/editor/ScriptEditor";
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor";
import { BeatBoard } from "@/components/editor/BeatBoard";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { VersionHistory } from "@/components/versions/VersionHistory";
import { CommentsPanel } from "@/components/comments/CommentsPanel";
import { AnnotationsPanel } from "@/components/annotations/AnnotationsPanel";
import { AIAssistantPanel } from "@/components/ai/AIAssistantPanel";
import { GrammarCheckResults } from "@/components/ai/GrammarCheckResults";
import { ScriptReviewPanel } from "@/components/ai/ScriptReviewPanel";
import { AIGenerationDialog } from "@/components/ai/AIGenerationDialog";
import { SpeakerLegend } from "@/components/editor/SpeakerLegend";
import { getFeatureFlags } from "@/lib/feature-flags";
import { userFacingError } from "@/lib/convex-error";
import { toast } from "sonner";
import { useSpeakerStore, Speaker } from "@/store/speaker-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GrammarCheckResult {
  issues?: Array<{
    type: "grammar" | "spelling" | "style" | "tone" | "clarity";
    message: string;
    suggestion: string;
    severity: "low" | "medium" | "high";
  }>;
  overallScore?: number;
  summary?: string;
}

interface ScriptReviewResult {
  overallScore?: number;
  strengths?: string[];
  improvements?: string[];
  suggestions?: Array<{
    chapter: string;
    suggestion: string;
    priority: "low" | "medium" | "high";
  }>;
  toneCompliance?: { score: number; notes: string };
  pacing?: { score: number; notes: string };
  clarity?: { score: number; notes: string };
}

export default function ScriptPage() {
  const params = useParams();
  const router = useRouter();
  const flags = getFeatureFlags();
  const scriptId = params.id as Id<"scripts">;
  const script = useQuery(api.scripts.get, { scriptId });
  const { scheduleAutosave, saveNow, cancelPendingSave, setOnSaveComplete, getLastSavedContent, initializeLastSaved, syncLastEditedAt } = useAutosave(scriptId);
  const { mode, viewMode, toggleViewMode, commentsOpen, setCommentsOpen, annotationsOpen, setAnnotationsOpen, collaborationEnabled, speakersOpen, setSpeakersOpen } = useEditorStore();
  const { chromeRevealed, chromeMouseHandlers } = useFocusChromeReveal(viewMode);
  const { speakers, setSpeakers } = useSpeakerStore();
  const updateSpeakers = useMutation(api.scripts.updateSpeakers);
  const [editorRef, setEditorRef] = useState<Editor | null>(null);
  
  // Compute initial content from script using useMemo (no effect needed)
  const initialContent = useMemo<JSONContent | null>(() => {
    if (script === undefined || script === null) return null;

    const emptyContent = { type: "doc" as const, content: [{ type: "paragraph" }] };

    if (script.content && script.content.trim() !== "") {
      try {
        const parsed = JSON.parse(script.content);

        if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
          return parsed;
        } else {
          console.error(`[Script ${scriptId}] Invalid document structure:`, {
            hasType: !!parsed?.type,
            type: parsed?.type,
            hasContent: !!parsed?.content
          });
        }
      } catch (parseError) {
        console.error(`[Script ${scriptId}] Failed to parse script content:`, parseError);
      }
    }

    return emptyContent;
  }, [script, scriptId]);
  
  // Local content state - starts from initial content, then tracks user edits
  const [localContent, setLocalContent] = useState<JSONContent | null>(() => initialContent);
  const contentInitialized = useRef(false);
  const isRestoringVersionRef = useRef(false);
  const lastScriptContentRef = useRef<string | null>(null);

  // AI Panel States
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [grammarCheckResults, setGrammarCheckResults] = useState<GrammarCheckResult | null>(null);
  const [reviewResults, setReviewResults] = useState<ScriptReviewResult | null>(null);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [generationTask, setGenerationTask] = useState<"generate" | "expand" | "rephrase" | "summarize">("generate");
  const [generationPrompt, setGenerationPrompt] = useState("");

  // AI Actions
  const checkGrammar = useAction(api.ai.checkGrammarAndStyle);
  const reviewScript = useAction(api.ai.reviewScript);

  // Inline AI suggestions: turns a grammar check into anchored annotation rows
  // and drives Apply / Apply all from the annotations panel. All ProseMirror
  // position logic lives in the hook + lib/tiptap; this page only orchestrates.
  const {
    createBatch,
    applyOne,
    applyAll,
    pendingConfirm,
    confirmPending,
    cancelPending,
  } = useApplySuggestions(scriptId, editorRef);

  // Track when save completes - we use getLastSavedContent() to compare instead
  useEffect(() => {
    setOnSaveComplete(() => {
      // Save completed - getLastSavedContent() will return the saved content
      // so we can compare it in the script.content effect
    });
    return () => setOnSaveComplete(null);
  }, [setOnSaveComplete]);

  // Initialize speakers from script data. Always set (falling back to an empty
  // list) so a script without speakers doesn't inherit the previous script's
  // speakers from the global store.
  useEffect(() => {
    if (script === undefined) return;
    const scriptSpeakers = Array.isArray(script?.speakers)
      ? (script.speakers as Speaker[])
      : [];
    setSpeakers(scriptSpeakers);
  }, [script, setSpeakers]);

  // Handle speakers change - save to Convex
  const handleSpeakersChange = useCallback(
    async (newSpeakers: Speaker[]) => {
      try {
        // Map null to undefined for Convex compatibility
        const speakersForConvex = newSpeakers.map((s) => ({
          ...s,
          defaultVisibility: s.defaultVisibility ?? undefined,
        }));
        await updateSpeakers({
          scriptId,
          speakers: speakersForConvex,
        });
      } catch (error) {
        console.error("Failed to save speakers:", error);
        toast.error("Failed to save speakers");
      }
    },
    [updateSpeakers, scriptId]
  );

  // Initialize localContent and autosave when script first loads
  useEffect(() => {
    if (script !== undefined && script !== null && !contentInitialized.current && initialContent) {
      const contentString = script.content && script.content.trim() !== ""
        ? script.content
        : JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

      // Update local content - use regular setState, not startTransition
      // startTransition defers updates which can cause the loading screen to stay visible
      setLocalContent(initialContent);

      // Initialize autosave
      if (typeof initializeLastSaved === 'function') {
        try {
          initializeLastSaved(contentString, script.lastEditedAt);
          lastScriptContentRef.current = contentString;
        } catch (initError) {
          console.error("Error initializing last saved content:", initError);
        }
      }

      contentInitialized.current = true;
    }
  }, [script, initialContent, initializeLastSaved]);


  // Update local content when script changes (e.g., version restore)
  // BUT only if it's different from what we last saved (to avoid feedback loop)
  useEffect(() => {
    if (script?.content && contentInitialized.current && initialContent) {
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
          // Content is unchanged but `lastEditedAt` moved — a metadata mutation
          // (title/speakers/stage) touched the script. Resync the optimistic-
          // concurrency baseline so the next content save isn't rejected as stale
          // and silently dropped.
          syncLastEditedAt(script.lastEditedAt);
          return;
        }
        
        // Skip if this is the same as what we already have
        if (script.content === lastScriptContentRef.current && !isRestoringVersionRef.current) {
          return;
        }
        
        // This is a real external change (version restore, etc.)
        // Update via initialContent memo which will trigger the effect above
        lastScriptContentRef.current = script.content;
        setLocalContent(initialContent);
        isRestoringVersionRef.current = false;
        // Resync the autosave concurrency baseline so the next save builds
        // on this new server state instead of being rejected as stale.
        syncLastEditedAt(script.lastEditedAt);
      } catch {
        // ignore parse errors
      }
    }
  }, [script?.content, script?.lastEditedAt, initialContent, getLastSavedContent, syncLastEditedAt]);

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

  // Called by VersionHistory right before a restore mutation runs: drop any
  // debounced autosave (it holds pre-restore content that would overwrite the
  // restored version) and flag the incoming content change as a restore.
  const handleBeforeRestore = useCallback(() => {
    isRestoringVersionRef.current = true;
    cancelPendingSave();
  }, [cancelPendingSave]);

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

  // AI Handler Functions
  const handleOpenAIChat = useCallback(() => {
    setAiChatOpen(true);
  }, []);

  const handleGrammarCheck = useCallback(async () => {
    if (!flags.aiGrammarCheckEnabled) return;

    try {
      toast.info("Checking grammar and style...");
      const result = await checkGrammar({ scriptId });

      // Dev-only harvest hook for the anchor-rate gate. The fixtures in
      // lib/tiptap/__fixtures__/ must come from this exact code path — a
      // reconstructed prompt would measure the reconstruction, not production.
      // Neither the editor nor the action result is otherwise reachable from
      // the console, so expose the pair the fixture format needs.
      // See lib/tiptap/__fixtures__/README.md.
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as Record<string, unknown>).__lastGrammarHarvest = {
          docJSON: editorRef?.getJSON(),
          issues: result.issues,
        };
        console.info(
          "[harvest] window.__lastGrammarHarvest is ready — see lib/tiptap/__fixtures__/README.md"
        );
      }

      // Flag OFF: exactly today's behaviour — a read-only results panel, no rows
      // written. Flag ON: the issues become anchored annotation rows and the
      // results live in the annotations panel instead, so we don't show both.
      if (flags.aiInlineSuggestionsEnabled) {
        const stats = await createBatch(result.issues ?? [], {
          model: result.model,
          provider: result.provider,
        });
        // createBatch returns null only when the editor isn't mounted yet.
        if (stats) {
          setAnnotationsOpen(true);
          toast.success(
            stats.total === 0
              ? "No issues found"
              : `${stats.anchored}/${stats.total} suggestions placed in the document`
          );
        } else {
          setGrammarCheckResults(result);
        }
      } else {
        setGrammarCheckResults(result);
      }
    } catch (error) {
      console.error("Grammar check error:", error);
      toast.error(
        userFacingError(error, "Failed to check grammar. Please try again.")
      );
    }
  }, [
    flags.aiGrammarCheckEnabled,
    flags.aiInlineSuggestionsEnabled,
    checkGrammar,
    createBatch,
    setAnnotationsOpen,
    scriptId,
    editorRef,
  ]);

  const handleScriptReview = useCallback(async () => {
    if (!flags.aiReviewEnabled) return;

    try {
      toast.info("Reviewing script...");
      const result = await reviewScript({ scriptId });
      setReviewResults(result);
    } catch (error) {
      console.error("Review error:", error);
      toast.error(
        userFacingError(error, "Failed to review script. Please try again.")
      );
    }
  }, [flags.aiReviewEnabled, reviewScript, scriptId]);

  const handleInsertContent = useCallback(
    (content: string) => {
      if (editorRef) {
        editorRef.commands.insertContent(content);
      }
    },
    [editorRef]
  );

  // Listen for AI slash command events
  useEffect(() => {
    const handleAIGenerate = () => {
      setGenerationTask("generate");
      setGenerationPrompt("");
      setGenerationDialogOpen(true);
    };

    const handleAIExpand = (e: Event) => {
      const { selectedText } = (e as CustomEvent).detail;
      setGenerationTask("expand");
      setGenerationPrompt(selectedText || "");
      setGenerationDialogOpen(true);
    };

    const handleAIRephrase = (e: Event) => {
      const { selectedText } = (e as CustomEvent).detail;
      setGenerationTask("rephrase");
      setGenerationPrompt(selectedText || "");
      setGenerationDialogOpen(true);
    };

    const handleAISummarize = (e: Event) => {
      const { selectedText } = (e as CustomEvent).detail;
      setGenerationTask("summarize");
      setGenerationPrompt(selectedText || "");
      setGenerationDialogOpen(true);
    };

    window.addEventListener("ai:generate", handleAIGenerate);
    window.addEventListener("ai:expand", handleAIExpand);
    window.addEventListener("ai:rephrase", handleAIRephrase);
    window.addEventListener("ai:summarize", handleAISummarize);

    return () => {
      window.removeEventListener("ai:generate", handleAIGenerate);
      window.removeEventListener("ai:expand", handleAIExpand);
      window.removeEventListener("ai:rephrase", handleAIRephrase);
      window.removeEventListener("ai:summarize", handleAISummarize);
    };
  }, []);

  // Focus Mode keyboard shortcut: Cmd+Shift+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleViewMode();
        const newMode = viewMode === "focus" ? "edit" : "focus";
        toast.success(`${newMode === "focus" ? "Focus" : "Edit"} Mode activated`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, toggleViewMode]);

  // Show onboarding tooltip on first Focus Mode activation
  useEffect(() => {
    if (viewMode === "focus") {
      const hasSeenTip = localStorage.getItem("takescript-focus-mode-tip");
      if (!hasSeenTip) {
        toast.info(
          "Move the cursor to the top of the screen to show controls, or press ⌘⇧F to exit Focus.",
          { duration: 5000 }
        );
        localStorage.setItem("takescript-focus-mode-tip", "true");
      }
    }
  }, [viewMode]);

  // Save immediately on blur (when user clicks away) - like Google Docs
  useEffect(() => {
    if (!editorRef) return;

    // Safely check if view is available - accessing view.dom can throw if not mounted
    let editorElement: HTMLElement | null = null;
    try {
      if (editorRef.view && editorRef.view.dom) {
        editorElement = editorRef.view.dom;
      }
    } catch {
      // View not available yet, skip setting up blur handler
      return;
    }

    if (!editorElement) return;

    const handleBlur = () => {
      if (localContent) {
        // Save immediately when editor loses focus
        saveNow(JSON.stringify(localContent)).catch((error) => {
          console.error("Failed to save on blur:", error);
        });
      }
    };

    editorElement.addEventListener("blur", handleBlur, true);

    return () => {
      if (editorElement) {
        editorElement.removeEventListener("blur", handleBlur, true);
      }
    };
  }, [editorRef, localContent, saveNow]);

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
          Make sure you&apos;re signed in and that the link is correct.
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
    <div
      className="flex h-screen flex-col bg-background"
      data-mode={mode}
      data-view-mode={viewMode}
      data-chrome-revealed={chromeRevealed ? "true" : undefined}
    >
      {/* Topbar */}
      <Topbar
        scriptId={scriptId}
        title={script.title}
        content={localContent}
        onSaveNow={handleSaveNow}
        onOpenAIChat={handleOpenAIChat}
        onGrammarCheck={handleGrammarCheck}
        onScriptReview={handleScriptReview}
        chromeMouseHandlers={viewMode === "focus" ? chromeMouseHandlers : undefined}
      />

      {/* Beat Board */}
      <BeatBoard
        content={localContent}
        onChapterClick={handleChapterClick}
        chromeMouseHandlers={viewMode === "focus" ? chromeMouseHandlers : undefined}
      />

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
        <VersionHistory scriptId={scriptId} onBeforeRestore={handleBeforeRestore} />

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
          onApplyOne={applyOne}
          onApplyAll={applyAll}
        />

        {/* Speaker Legend Panel */}
        <SpeakerLegend
          editor={editorRef}
          isOpen={speakersOpen}
          onClose={() => setSpeakersOpen(false)}
          onSpeakersChange={handleSpeakersChange}
        />

        {/* AI Assistant Panel */}
        {flags.aiChatEnabled && (
          <AIAssistantPanel
            scriptId={scriptId}
            isOpen={aiChatOpen}
            onClose={() => setAiChatOpen(false)}
          />
        )}

        {/* Grammar Check Results */}
        {grammarCheckResults && (
          <GrammarCheckResults
            issues={grammarCheckResults.issues || []}
            overallScore={grammarCheckResults.overallScore || 0}
            summary={grammarCheckResults.summary || ""}
            onClose={() => setGrammarCheckResults(null)}
          />
        )}

        {/* Script Review Panel */}
        {reviewResults && (
          <ScriptReviewPanel
            overallScore={reviewResults.overallScore || 0}
            strengths={reviewResults.strengths || []}
            improvements={reviewResults.improvements || []}
            suggestions={reviewResults.suggestions || []}
            toneCompliance={reviewResults.toneCompliance || { score: 0, notes: "" }}
            pacing={reviewResults.pacing || { score: 0, notes: "" }}
            clarity={reviewResults.clarity || { score: 0, notes: "" }}
            onClose={() => setReviewResults(null)}
          />
        )}

        {/* AI Generation Dialog */}
        {flags.aiGenerationEnabled && (
          <AIGenerationDialog
            scriptId={scriptId}
            open={generationDialogOpen}
            onOpenChange={(open) => {
              setGenerationDialogOpen(open);
              if (!open) {
                setGenerationPrompt("");
                setGenerationTask("generate");
              }
            }}
            onInsert={handleInsertContent}
            initialPrompt={generationPrompt}
            initialTask={generationTask}
          />
        )}

      </div>

      {/* Drift confirmation for Apply / Apply all. The hook sets pendingConfirm
          only when the document no longer matches what the model saw; without
          this dialog the apply would silently do nothing. */}
      <AlertDialog
        open={pendingConfirm !== null}
        onOpenChange={(open) => {
          if (!open) cancelPending();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              The text has changed since this suggestion
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm && pendingConfirm.driftedCount > 1
                ? `${pendingConfirm.driftedCount} suggestions no longer match the document. Apply anyway?`
                : "This suggestion no longer matches the document. Apply anyway?"}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingConfirm?.sample && (
            <div className="space-y-2 text-sm">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Expected
                </div>
                <div className="rounded bg-muted px-2 py-1 italic">
                  &ldquo;{pendingConfirm.sample.expectedText}&rdquo;
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Now in the document
                </div>
                <div className="rounded bg-muted px-2 py-1 italic">
                  &ldquo;{pendingConfirm.sample.currentText}&rdquo;
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>
              Apply anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
