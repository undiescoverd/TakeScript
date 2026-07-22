/**
 * Bridge: `checkGrammarAndStyle` output -> `createAISuggestions` input + marks.
 *
 * This is where the model's verbatim quotes become real ProseMirror positions.
 * It must run client-side against the LIVE editor doc — see the header of
 * `resolve-text-position.ts` for why the server's copy cannot be used.
 *
 * Input order is preserved end to end. `createAISuggestions` returns its new
 * ids in input order, so `marks[i].index` indexes straight into that array;
 * any reordering here would silently attach every highlight to the wrong row.
 */

import type { Node as PMNode } from "@tiptap/pm/model";
import {
  buildDocIndex,
  resolveSpan,
  dropOverlaps,
  type ResolveFailure,
  type ResolveResult,
} from "./resolve-text-position";

/** One entry from the grammar-check action's `issues` array. */
export interface AIIssue {
  type: "grammar" | "spelling" | "style" | "tone" | "clarity";
  originalText?: string;
  occurrence?: number;
  contextBefore?: string;
  contextAfter?: string;
  message: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
}

/** Exactly the row shape `createAISuggestions` validates. */
export interface PreparedSuggestion {
  content: string;
  selectedText: string;
  from: number;
  to: number;
  anchored: boolean;
  suggestionType?: AIIssue["type"];
  suggestedText?: string;
  severity?: AIIssue["severity"];
}

export interface SuggestionBatch {
  suggestions: PreparedSuggestion[];
  marks: Array<{ index: number; from: number; to: number }>;
  stats: {
    total: number;
    anchored: number;
    failures: Record<ResolveFailure, number>;
  };
}

export interface BuildBatchOptions {
  /** Restrict matching to a slice of flattened text (selection-only trigger). */
  searchWindow?: { start: number; end: number };
  /** Hard cap; must not exceed the mutation's own limit. */
  max?: number;
}

/** Mirrors MAX_AI_SUGGESTIONS_PER_BATCH in convex/annotations.ts. */
export const MAX_SUGGESTIONS_PER_BATCH = 50;

function emptyFailures(): Record<ResolveFailure, number> {
  return {
    "too-short": 0,
    "not-found": 0,
    ambiguous: 0,
    "crosses-block": 0,
    "no-quote": 0,
  };
}

export function buildSuggestionBatch(
  doc: PMNode,
  issues: AIIssue[],
  opts: BuildBatchOptions = {}
): SuggestionBatch {
  const max = Math.min(opts.max ?? MAX_SUGGESTIONS_PER_BATCH, MAX_SUGGESTIONS_PER_BATCH);
  // Truncate here rather than letting the mutation throw: losing the tail of a
  // long issue list is survivable, losing the whole batch is not.
  const capped = issues.slice(0, max);

  const index = buildDocIndex(doc);

  const resolved: Array<{ item: AIIssue; result: ResolveResult }> = capped.map(
    (issue) => {
      const quote = issue.originalText?.trim();
      if (!quote) {
        // Rule 6 of the prompt: the model may decline to point at a span.
        // That is a legitimate general note, not a failure to hide.
        return { item: issue, result: { ok: false, reason: "no-quote" as const } };
      }
      return {
        item: issue,
        result: resolveSpan(
          index,
          issue.originalText as string,
          issue.occurrence,
          issue.contextBefore,
          issue.contextAfter,
          opts.searchWindow
        ),
      };
    }
  );

  // Two marks fighting over the same characters make "apply fix" ill-defined,
  // so later overlappers are demoted to unanchored notes rather than dropped.
  const deconflicted = dropOverlaps(resolved);

  const suggestions: PreparedSuggestion[] = [];
  const marks: Array<{ index: number; from: number; to: number }> = [];
  const failures = emptyFailures();

  deconflicted.forEach(({ item, result }, i) => {
    // "" means advice-only: there is nothing to substitute in.
    const replacement = item.suggestion?.length ? item.suggestion : undefined;

    if (result.ok) {
      suggestions.push({
        content: item.message,
        // The LIVE doc text, deliberately not the model's quote. The resolver
        // matches through same-length normalization, so the two can differ by
        // punctuation; storing what the document actually says keeps
        // `shouldConfirmApply` comparing like for like at apply time.
        selectedText: doc.textBetween(result.from, result.to),
        from: result.from,
        to: result.to,
        anchored: true,
        suggestionType: item.type,
        suggestedText: replacement,
        severity: item.severity,
      });
      marks.push({ index: i, from: result.from, to: result.to });
    } else {
      failures[result.reason]++;
      suggestions.push({
        content: item.message,
        selectedText: item.originalText ?? "",
        from: 0,
        to: 0,
        anchored: false,
        suggestionType: item.type,
        // No location means no apply. Carrying suggestedText here would render
        // an "Apply fix" button that could never do anything.
        suggestedText: undefined,
        severity: item.severity,
      });
    }
  });

  return {
    suggestions,
    marks,
    stats: { total: suggestions.length, anchored: marks.length, failures },
  };
}
