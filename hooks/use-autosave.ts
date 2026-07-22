"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";

const AUTOSAVE_DELAY = 2000; // 2 seconds after typing stops (like Google Docs)
const SAVE_INDICATOR_DELAY = 500; // Show "Saving..." after 500ms of continuous typing

export function useAutosave(scriptId: Id<"scripts">) {
  const updateScript = useMutation(api.scripts.update);
  const { setIsSaving, setLastSavedAt } = useEditorStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savingIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const queuedContentRef = useRef<string | null>(null);
  const saveRef = useRef<((content: string) => Promise<void>) | null>(null);
  const lastSavedContentRef = useRef<string | null>(null);
  const onSaveCompleteRef = useRef<((content: string) => void) | null>(null);
  const isSavingRef = useRef(false);

  const save = useCallback(
    async (content: string) => {
      // A save is already in flight: queue this (newer) content so it is
      // written as soon as the current save finishes, instead of dropping it.
      if (isSavingRef.current) {
        queuedContentRef.current = content;
        return;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      try {
        let toSave: string | null = content;
        while (toSave !== null) {
          try {
            await updateScript({ scriptId, content: toSave });
            lastSavedContentRef.current = toSave;
            if (pendingContentRef.current === toSave) {
              pendingContentRef.current = null;
            }
            setLastSavedAt(Date.now());
            // Notify that save completed
            if (onSaveCompleteRef.current) {
              onSaveCompleteRef.current(toSave);
            }
          } catch (error) {
            console.error("Failed to save:", error);
            // Keep the unsaved content pending so blur/unload/unmount retries it
            if (pendingContentRef.current === null) {
              pendingContentRef.current = toSave;
            }
            break;
          }
          // Drain anything queued while we were saving
          toSave = queuedContentRef.current;
          queuedContentRef.current = null;
          if (toSave === lastSavedContentRef.current) {
            toSave = null;
          }
        }
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [scriptId, updateScript, setIsSaving, setLastSavedAt]
  );

  // Keep save function in ref for event listeners
  saveRef.current = save;

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (savingIndicatorTimeoutRef.current) {
      clearTimeout(savingIndicatorTimeoutRef.current);
      savingIndicatorTimeoutRef.current = null;
    }
  }, []);

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
        // (save() clears pendingContentRef itself once the write succeeds)
        if (contentToSave && contentToSave !== lastSavedContentRef.current && saveRef.current) {
          saveRef.current(contentToSave);
        }
      }, AUTOSAVE_DELAY);
    },
    [setIsSaving]
  );

  const saveNow = useCallback(
    async (content: string) => {
      clearTimers();
      // Pending content is cleared by save() only after a successful write,
      // so a failure here leaves it retryable by later saves.
      await save(content);
    },
    [save, clearTimers]
  );

  // Discard any scheduled/pending autosave without saving it.
  // Used before a version restore so a stale debounced save can't overwrite
  // the restored content.
  const cancelPendingSave = useCallback(() => {
    clearTimers();
    pendingContentRef.current = null;
    queuedContentRef.current = null;
    if (!isSavingRef.current) {
      setIsSaving(false);
    }
  }, [clearTimers, setIsSaving]);

  // Save pending content when the page is hidden or unloading.
  // NOTE: these fire an async Convex mutation, which is reliable for tab
  // switches and SPA navigation but best-effort on hard close/refresh (the
  // browser may kill the connection before the write lands). Pending content
  // is intentionally NOT cleared here — save() clears it only on success, so
  // a surviving page can retry.
  useEffect(() => {
    const flushPending = () => {
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
        saveRef.current(content).catch((error) => {
          console.error("Failed to save on page hide/unload:", error);
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPending();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushPending);
    window.addEventListener("beforeunload", flushPending);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushPending);
      window.removeEventListener("beforeunload", flushPending);
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

  return {
    scheduleAutosave,
    saveNow,
    cancelPendingSave,
    setOnSaveComplete,
    getLastSavedContent,
    initializeLastSaved,
  };
}
