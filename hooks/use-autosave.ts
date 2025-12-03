"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";

const AUTOSAVE_DELAY = 30000; // 30 seconds

export function useAutosave(scriptId: Id<"scripts">) {
  const updateScript = useMutation(api.scripts.update);
  const { setIsSaving, setLastSavedAt } = useEditorStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<string | null>(null);

  const save = useCallback(
    async (content: string) => {
      try {
        setIsSaving(true);
        await updateScript({ scriptId, content });
        setLastSavedAt(Date.now());
      } catch (error) {
        console.error("Failed to save:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [scriptId, updateScript, setIsSaving, setLastSavedAt]
  );

  const scheduleAutosave = useCallback(
    (content: string) => {
      pendingContentRef.current = content;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (pendingContentRef.current) {
          save(pendingContentRef.current);
          pendingContentRef.current = null;
        }
      }, AUTOSAVE_DELAY);
    },
    [save]
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Save any pending content on unmount
      if (pendingContentRef.current) {
        save(pendingContentRef.current);
      }
    };
  }, [save]);

  return { scheduleAutosave, saveNow };
}
