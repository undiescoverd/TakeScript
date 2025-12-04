"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";

const AUTOSAVE_DELAY = 5000; // 5 seconds for more frequent saves

export function useAutosave(scriptId: Id<"scripts">) {
  const updateScript = useMutation(api.scripts.update);
  const { setIsSaving, setLastSavedAt } = useEditorStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const saveRef = useRef<((content: string) => Promise<void>) | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const onSaveCompleteRef = useRef<((content: string) => void) | null>(null);

  const save = useCallback(
    async (content: string) => {
      try {
        setIsSaving(true);
        await updateScript({ scriptId, content });
        lastSavedContentRef.current = content;
        setLastSavedAt(Date.now());
        // Notify that save completed
        if (onSaveCompleteRef.current) {
          onSaveCompleteRef.current(content);
        }
      } catch (error) {
        console.error("Failed to save:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [scriptId, updateScript, setIsSaving, setLastSavedAt]
  );

  // Keep save function in ref for event listeners
  saveRef.current = save;

  const scheduleAutosave = useCallback(
    (content: string) => {
      pendingContentRef.current = content;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (pendingContentRef.current && saveRef.current) {
          saveRef.current(pendingContentRef.current);
          pendingContentRef.current = null;
        }
      }, AUTOSAVE_DELAY);
    },
    []
  );

  const saveNow = useCallback(
    async (content: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      pendingContentRef.current = null;
      await save(content);
    },
    [save]
  );

  // Save pending content when page becomes hidden (browser close, tab switch, navigation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && pendingContentRef.current && saveRef.current) {
        // Use sendBeacon for reliable save on page unload
        const content = pendingContentRef.current;
        // Clear the timeout since we're saving now
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Save synchronously
        saveRef.current(content).catch((error) => {
          console.error("Failed to save on visibility change:", error);
        });
        pendingContentRef.current = null;
      }
    };

    const handlePageHide = () => {
      if (pendingContentRef.current && saveRef.current) {
        const content = pendingContentRef.current;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Try to save, but don't block page unload
        saveRef.current(content).catch((error) => {
          console.error("Failed to save on page hide:", error);
        });
        pendingContentRef.current = null;
      }
    };

    const handleBeforeUnload = () => {
      if (pendingContentRef.current && saveRef.current) {
        const content = pendingContentRef.current;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Use sendBeacon or synchronous save attempt
        saveRef.current(content).catch((error) => {
          console.error("Failed to save on beforeunload:", error);
        });
        pendingContentRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Cleanup on unmount (navigation away)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Save any pending content on unmount (navigation)
      if (pendingContentRef.current && saveRef.current) {
        saveRef.current(pendingContentRef.current);
        pendingContentRef.current = null;
      }
    };
  }, []);

  // Set callback to be notified when save completes
  const setOnSaveComplete = useCallback((callback: ((content: string) => void) | null) => {
    onSaveCompleteRef.current = callback;
  }, []);

  // Get last saved content (for comparison to avoid feedback loops)
  const getLastSavedContent = useCallback(() => {
    return lastSavedContentRef.current;
  }, []);

  return { scheduleAutosave, saveNow, setOnSaveComplete, getLastSavedContent };
}
