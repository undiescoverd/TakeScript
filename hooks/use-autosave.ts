"use client";

import { useAction, useConvexAuth } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";
import { toast } from "sonner";

const AUTOSAVE_DELAY = 2000; // 2 seconds after typing stops (like Google Docs)
const SAVE_INDICATOR_DELAY = 500; // Show "Saving..." after 500ms of continuous typing

interface SaveRequest {
  content: string;
  skipAuthCheck?: boolean;
}

export function useAutosave(scriptId: Id<"scripts">) {
  const updateScript = useAction(api.scripts.updateWithR2);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { setIsSaving, setLastSavedAt } = useEditorStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savingIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const saveRef = useRef<((content: string, skipAuthCheck?: boolean) => Promise<void>) | null>(
    null
  );
  const lastSavedContentRef = useRef<string | null>(null);
  const onSaveCompleteRef = useRef<((content: string) => void) | null>(null);
  const isSavingRef = useRef(false);
  const saveQueueRef = useRef<SaveRequest[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Perform the actual save operation
  const performSave = useCallback(
    async (content: string, skipAuthCheck = false) => {
      // Check authentication before attempting save (unless explicitly skipped for cleanup saves)
      if (!skipAuthCheck && !isAuthenticated) {
        console.warn("Save skipped: User not authenticated");
        if (!isLoading) {
          // Only show error if auth is fully loaded and user is definitely not authenticated
          toast.error("Unable to save: Please sign in again", {
            description: "Your session may have expired",
            duration: 5000,
          });
        }
        return;
      }

      try {
        isSavingRef.current = true;
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

        // Check if error is authentication-related
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("Not authenticated") ||
          errorMessage.includes("Unauthenticated")
        ) {
          toast.error("Unable to save: Authentication required", {
            description: "Please refresh the page and sign in again",
            duration: 7000,
          });
        } else {
          // Other errors - show generic message
          toast.error("Failed to save changes", {
            description: "Your changes may not be saved. Please try again.",
            duration: 5000,
          });
        }
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [scriptId, updateScript, setIsSaving, setLastSavedAt, isAuthenticated, isLoading]
  );

  // Process the save queue sequentially
  const processSaveQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || saveQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;

    while (saveQueueRef.current.length > 0) {
      const request = saveQueueRef.current[0];

      // Deduplicate: skip if content matches what we just saved
      if (request.content === lastSavedContentRef.current) {
        saveQueueRef.current.shift();
        continue;
      }

      // Remove duplicates from queue (keep only the last occurrence of each unique content)
      const uniqueContent = new Set<string>();
      saveQueueRef.current = saveQueueRef.current.filter((req) => {
        if (uniqueContent.has(req.content)) {
          return false; // Remove duplicates
        }
        uniqueContent.add(req.content);
        return true;
      });

      // Recheck after deduplication
      if (saveQueueRef.current.length === 0) {
        break;
      }

      const nextRequest = saveQueueRef.current.shift()!;
      await performSave(nextRequest.content, nextRequest.skipAuthCheck);
    }

    isProcessingQueueRef.current = false;
  }, [performSave]);

  const save = useCallback(
    async (content: string, skipAuthCheck = false) => {
      // Add to queue
      saveQueueRef.current.push({ content, skipAuthCheck });

      // Process queue
      await processSaveQueue();
    },
    [processSaveQueue]
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
      if (
        document.visibilityState === "hidden" &&
        pendingContentRef.current &&
        saveRef.current &&
        isAuthenticated
      ) {
        // Only attempt save if authenticated
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
        // Save synchronously (skip auth check since we already checked)
        saveRef.current(content, true).catch((error) => {
          console.error("Failed to save on visibility change:", error);
        });
        pendingContentRef.current = null;
      }
    };

    const handlePageHide = () => {
      if (pendingContentRef.current && saveRef.current && isAuthenticated) {
        const content = pendingContentRef.current;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (savingIndicatorTimeoutRef.current) {
          clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
        }
        // Try to save, but don't block page unload (skip auth check since we already checked)
        saveRef.current(content, true).catch((error) => {
          console.error("Failed to save on page hide:", error);
        });
        pendingContentRef.current = null;
      }
    };

    const handleBeforeUnload = () => {
      if (pendingContentRef.current && saveRef.current && isAuthenticated) {
        const content = pendingContentRef.current;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (savingIndicatorTimeoutRef.current) {
          clearTimeout(savingIndicatorTimeoutRef.current);
          savingIndicatorTimeoutRef.current = null;
        }
        // Use sendBeacon or synchronous save attempt (skip auth check since we already checked)
        saveRef.current(content, true).catch((error) => {
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
  }, [isAuthenticated]);

  // Cleanup on unmount (navigation away)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (savingIndicatorTimeoutRef.current) {
        clearTimeout(savingIndicatorTimeoutRef.current);
      }
      // Save any pending content on unmount (navigation) - only if authenticated
      if (pendingContentRef.current && saveRef.current && isAuthenticated) {
        saveRef.current(pendingContentRef.current, true);
        pendingContentRef.current = null;
      }
    };
  }, [isAuthenticated]);

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
