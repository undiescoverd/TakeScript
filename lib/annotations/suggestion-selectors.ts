/**
 * Pure decisions the annotations panel makes about AI suggestion rows.
 *
 * Kept out of the React component so "which rows get an Apply button" and
 * "what does Apply all act on" can be unit-tested without a DOM — the same
 * split the apply hook uses for its ProseMirror logic.
 */

/** The row fields these decisions read; a superset row (the Convex doc) is fine. */
export interface SuggestionRow {
  authorType?: "user" | "ai";
  anchored?: boolean;
  suggestedText?: string;
  resolved: boolean;
  batchId?: string;
  createdAt: number;
}

export interface SuggestionEligibility {
  isAI: boolean;
  /** Anchored:false — the model gave no locatable quote (prompt rule 6). */
  isUnanchored: boolean;
  /** Anchored, has replacement text, and still open: safe to offer Apply. */
  canApply: boolean;
}

export function suggestionEligibility(row: SuggestionRow): SuggestionEligibility {
  const isAI = row.authorType === "ai";
  const isUnanchored = isAI && row.anchored === false;
  const canApply =
    isAI &&
    row.anchored === true &&
    !!row.suggestedText &&
    !row.resolved;
  return { isAI, isUnanchored, canApply };
}

/**
 * Rows "Apply all" acts on: the anchored, applicable AI rows from the newest
 * batch only.
 *
 * Newest batch = the batchId of the most recently created AI row. Scoping to
 * one run keeps the count honest — sweeping suggestions from several separate
 * checks at once is rarely what the user means, and mixing batches would make
 * "Apply all (N)" lie about what it does.
 *
 * Input should already be the *unresolved* rows; applied/dismissed rows must
 * not reappear here.
 */
export function selectNewestBatchTargets<T extends SuggestionRow>(
  unresolvedRows: T[]
): T[] {
  const aiRows = unresolvedRows.filter((a) => a.authorType === "ai");

  let newestBatchId: string | undefined;
  let newestAt = -Infinity;
  for (const row of aiRows) {
    if (!row.batchId) continue;
    if (row.createdAt > newestAt) {
      newestAt = row.createdAt;
      newestBatchId = row.batchId;
    }
  }

  if (newestBatchId === undefined) return [];

  return aiRows.filter(
    (a) =>
      a.batchId === newestBatchId &&
      a.anchored === true &&
      !!a.suggestedText
  );
}
