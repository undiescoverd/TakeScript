"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  buildSuggestionBatch,
  type AIIssue,
} from "@/lib/tiptap/build-suggestion-batch";
import { findAnnotationRange } from "@/lib/tiptap/find-annotation-range";
import {
  planApply,
  buildApplyTransaction,
  type ApplyTarget,
} from "@/lib/tiptap/apply-suggestion";

/**
 * React orchestration for AI-authored anchored suggestions.
 *
 * Deliberately holds NO ProseMirror logic — every position decision lives in
 * the pure, unit-tested modules under lib/tiptap. What this owns is the parts
 * that cannot be unit-tested: the Convex mutations, the toasts, the dispatch,
 * and the confirmation state.
 */

/** The subset of an annotation row these operations need. */
export interface ApplicableAnnotation {
  _id: Id<"annotations">;
  selectedText: string;
  suggestedText?: string;
  anchored?: boolean;
}

export interface PendingConfirm {
  targets: ApplyTarget[];
  /** How many of them no longer match the text they were written against. */
  driftedCount: number;
  /** Shown in the dialog: what the document says now vs. what was expected. */
  sample: { currentText: string; expectedText: string } | null;
}

export interface CreateBatchOptions {
  model: string;
  provider: string;
  searchWindow?: { start: number; end: number };
}

export function useApplySuggestions(
  scriptId: Id<"scripts">,
  editor: Editor | null
) {
  const createAISuggestions = useMutation(api.annotations.createAISuggestions);
  const markAppliedBatch = useMutation(api.annotations.markAppliedBatch);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  /**
   * Persist a batch of AI issues, then highlight the anchored ones.
   *
   * Order is forced: the mark carries the annotation id, so the rows must exist
   * before the marks can be drawn. That makes the insert an await, and a user
   * typing during that round-trip would invalidate every position resolved
   * beforehand — hence the doc-identity check afterwards.
   */
  const createBatch = useCallback(
    async (issues: AIIssue[], opts: CreateBatchOptions) => {
      if (!editor) return null;

      const savedSelection = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
      const docBefore = editor.state.doc;
      let batch = buildSuggestionBatch(docBefore, issues, {
        searchWindow: opts.searchWindow,
      });

      const ids = await createAISuggestions({
        scriptId,
        batchId: crypto.randomUUID(),
        model: opts.model,
        provider: opts.provider,
        suggestions: batch.suggestions,
      });

      // The document moved while the insert was in flight. Re-resolve against
      // what is on screen now; ids still zip by index because the issue list
      // and therefore the row order is unchanged.
      if (editor.state.doc !== docBefore) {
        batch = buildSuggestionBatch(editor.state.doc, issues, {
          searchWindow: opts.searchWindow,
        });
      }

      let chain = editor.chain();
      for (const mark of batch.marks) {
        const annotationId = ids[mark.index];
        if (!annotationId) continue;
        chain = chain
          .setTextSelection({ from: mark.from, to: mark.to })
          .setAnnotation({ annotationId, color: "ai" });
      }
      chain.setTextSelection(savedSelection).run();

      return batch.stats;
    },
    [editor, scriptId, createAISuggestions]
  );

  /**
   * Commit a set of targets: edit the document, clear the marks, settle the DB.
   *
   * Re-plans against the current doc rather than trusting anything computed
   * before an await — a confirmation dialog is a pause of arbitrary length.
   *
   * Editor first, database second, on purpose. A failed mutation leaves a row
   * marked open whose fix is already in the text (visible, correctable). The
   * reverse ordering would report success while silently losing the edit.
   */
  const commit = useCallback(
    async (targets: ApplyTarget[]) => {
      if (!editor || targets.length === 0) return 0;

      const entries = planApply(editor.state.doc, targets);
      const skipped = targets.length - entries.length;

      if (entries.length === 0) {
        toast.error(
          "The highlighted text is no longer in the document — apply this one manually"
        );
        return 0;
      }

      // One command => one transaction => one undo step for the whole batch.
      editor.commands.command(({ tr, dispatch }) => {
        if (dispatch) {
          buildApplyTransaction(tr, editor.schema, entries);
        }
        return true;
      });

      // Belt-and-suspenders: replaceWith already sheds the mark by inserting a
      // bare text node, but a mark that somehow survived would leave a
      // highlight with no matching open row.
      for (const entry of entries) {
        try {
          editor.commands.removeAnnotation(entry.annotationId);
        } catch {
          // Editor view not ready; the row is settled below regardless.
        }
      }

      try {
        await markAppliedBatch({
          annotationIds: entries.map((e) => e.annotationId as Id<"annotations">),
        });
      } catch {
        toast.error(
          "Applied to the document, but couldn't update the suggestion list"
        );
        return entries.length;
      }

      if (skipped > 0) {
        toast.warning(
          `Applied ${entries.length}; skipped ${skipped} whose text had been edited apart`
        );
      } else {
        toast.success(
          entries.length === 1 ? "Suggestion applied" : `Applied ${entries.length} suggestions`
        );
      }

      return entries.length;
    },
    [editor, markAppliedBatch]
  );

  const applyOne = useCallback(
    async (annotation: ApplicableAnnotation) => {
      if (!editor) return;
      if (!annotation.anchored || !annotation.suggestedText) {
        toast.error("This suggestion has no replacement text to apply");
        return;
      }

      const found = findAnnotationRange(editor.state.doc, annotation._id);

      if (found.status === "missing") {
        toast.error("The highlighted text is no longer in the document");
        return;
      }
      if (found.status === "split") {
        // Replacing the outer bounds would eat whatever the user typed between
        // the fragments. Refusing costs one manual edit; guessing costs text.
        toast.error(
          "This suggestion's text has been edited apart; apply it manually"
        );
        return;
      }

      const target: ApplyTarget = {
        annotationId: annotation._id,
        suggestedText: annotation.suggestedText,
        expectedText: annotation.selectedText,
      };

      const [entry] = planApply(editor.state.doc, [target]);
      if (entry?.needsConfirm) {
        setPendingConfirm({
          targets: [target],
          driftedCount: 1,
          sample: {
            currentText: entry.currentText,
            expectedText: annotation.selectedText,
          },
        });
        return;
      }

      await commit([target]);
    },
    [editor, commit]
  );

  const applyAll = useCallback(
    async (annotations: ApplicableAnnotation[]) => {
      if (!editor) return;

      const targets: ApplyTarget[] = annotations
        .filter((a) => a.anchored && a.suggestedText)
        .map((a) => ({
          annotationId: a._id,
          suggestedText: a.suggestedText as string,
          expectedText: a.selectedText,
        }));

      if (targets.length === 0) {
        toast.error("No applicable suggestions");
        return;
      }

      const entries = planApply(editor.state.doc, targets);
      const drifted = entries.filter((e) => e.needsConfirm);

      if (drifted.length > 0) {
        const first = drifted[0];
        const original = targets.find((t) => t.annotationId === first.annotationId);
        setPendingConfirm({
          targets,
          driftedCount: drifted.length,
          sample: {
            currentText: first.currentText,
            expectedText: original?.expectedText ?? "",
          },
        });
        return;
      }

      await commit(targets);
    },
    [editor, commit]
  );

  const confirmPending = useCallback(async () => {
    const pending = pendingConfirm;
    setPendingConfirm(null);
    if (pending) {
      // commit() re-plans, so the dialog having been open for a while is fine.
      await commit(pending.targets);
    }
  }, [pendingConfirm, commit]);

  const cancelPending = useCallback(() => setPendingConfirm(null), []);

  return {
    createBatch,
    applyOne,
    applyAll,
    pendingConfirm,
    confirmPending,
    cancelPending,
  };
}
