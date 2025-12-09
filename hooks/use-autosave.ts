"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";
import { useSpeakerStore, Speaker } from "@/store/speaker-store";

const AUTOSAVE_DELAY = 2000; // 2 seconds after typing stops (like Google Docs)
const SAVE_INDICATOR_DELAY = 500; // Show "Saving..." after 500ms of continuous typing

export function useAutosave(scriptId: Id<"scripts">) {
  const updateScript = useMutation(api.scripts.update);
  const { setIsSaving, setLastSavedAt } = useEditorStore();
  const { speakers } = useSpeakerStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savingIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const saveRef = useRef<((content: string) => Promise<void>) | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const onSaveCompleteRef = useRef<((content: string) => void) | null>(null);
  const isSavingRef = useRef(false);

  const save = useCallback(
    async (content: string) => {
      // Prevent concurrent saves
      if (isSavingRef.current) {
        return;
      }

      try {
        isSavingRef.current = true;
        setIsSaving(true);
        // Save both content and current speakers to Convex
        await updateScript({ scriptId, content, speakers });
        lastSavedContentRef.current = content;
        setLastSavedAt(Date.now());
        // Notify that save completed
        if (onSaveCompleteRef.current) {
          onSaveCompleteRef.current(content);
        }
      } catch (error) {
        console.error("Failed to save:", error);
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [scriptId, updateScript, setIsSaving, setLastSavedAt, speakers]
  );

  // Keep save function in ref for event listeners
  saveRef.current = save;

  const scheduleAutosave = useCallback(
    (content: string) => {
      // Skip if content hasn't changed from what we last saved
      if (content === lastSavedContentRef.current) {
        // Clear saving indicator if user hasn't made changes
        if (savingIndicatorTimeoutRef.current) {
          clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
        }
        // Also clear the visual indicator since there's nothing to save
        if (!isSavingRef.current) {
          setIsSaving(false);
        }
        return;
      }

      // Skip if this is the same content we're already planning to save
      if (content === pendingContentRef.current) {
        return;
      }

      // Update pending content
      pendingContentRef.current = content;

      // Clear any existing timeout (debounce: reset timer on each keystroke)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Clear existing saving indicator timeout and hide indicator
      // This ensures we don't show "Saving..." prematurely
      if (savingIndicatorTimeoutRef.current) {
        clearTimeout(savingIndicatorTimeoutRef.current);
        savingIndicatorTimeoutRef.current = null;
      }
      // Hide the indicator while user is actively typing
      if (!isSavingRef.current) {
        setIsSaving(false);
      }

      // Show "Saving..." indicator only after continuous typing for 500ms
      // This prevents flashing "Saving..." on every keystroke
      savingIndicatorTimeoutRef.current = setTimeout(() => {
        if (pendingContentRef.current && !isSavingRef.current) {
          setIsSaving(true); // Visual indicator only, not actually saving yet
        }
      }, SAVE_INDICATOR_DELAY);

      // Schedule actual save after delay (only fires if user stops typing)
      timeoutRef.current = setTimeout(() => {
        const contentToSave = pendingContentRef.current;
        // Clear the timeout references
        timeoutRef.current = null;
        if (savingIndicatorTimeoutRef.current) {
          clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
        }

        // Clear the visual indicator before starting actual save
        // This ensures the indicator doesn't get stuck if save was never triggered
        if (!isSavingRef.current) {
          setIsSaving(false);
        }

        // Only save if content is still pending and different from last saved
        if (contentToSave && contentToSave !== lastSavedContentRef.current && saveRef.current) {
          saveRef.current(contentToSave);
        }
        pendingContentRef.current = null;
      }, AUTOSAVE_DELAY);
    },
    [setIsSaving]
  );

  const saveNow = useCallback(
    async (content: string) => {
      // Clear all pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (savingIndicatorTimeoutRef.current) {
        clearTimeout(savingIndicatorTimeoutRef.current);
        savingIndicatorTimeoutRef.current = null;
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
        // Clear the timeouts since we're saving now
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (savingIndicatorTimeoutRef.current) {
          clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
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
        if (savingIndicatorTimeoutRef.current) {
          clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
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
        if (savingIndicatorTimeoutRef.current) {
          clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
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
      if (savingIndicatorTimeoutRef.current) {
        clearTimeout(savingIndicatorTimeoutRef.current);
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

  // Initialize last saved content (call when script first loads)
  const initializeLastSaved = useCallback((content: string) => {
    lastSavedContentRef.current = content;
  }, []);

  return { scheduleAutosave, saveNow, setOnSaveComplete, getLastSavedContent, initializeLastSaved };
}
