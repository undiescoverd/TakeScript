/**
 * Turn accepted AI suggestions into a single document edit.
 *
 * Two invariants carry this module:
 *
 * 1. Replacement uses `tr.replaceWith(from, to, schema.text(next))`, never
 *    `insertContent`. Tiptap marks are `inclusive: true` by default, so text
 *    inserted at the boundary of an annotation highlight would inherit that
 *    highlight — the suggestion would appear applied yet still be lit up.
 *    Replacing the range with a bare text node makes the mark vanish by
 *    construction; `removeAnnotation` afterwards is belt-and-suspenders.
 *
 * 2. Entries are applied in DESCENDING `from` order, which is what lets this
 *    skip `tr.mapping` entirely. `dropOverlaps` (upstream, at batch-build time)
 *    guarantees the spans never overlap; going right-to-left then means every
 *    range still awaiting replacement lies strictly before every range already
 *    replaced, so its coordinates cannot have moved. Applying front-to-back
 *    against the same unmapped coordinates corrupts the document — there is a
 *    test asserting exactly that.
 */

import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import type { Transform } from "@tiptap/pm/transform";
import { findAnnotationRanges } from "./find-annotation-range";
import { normalizeSameLength } from "./resolve-text-position";

export interface ApplyTarget {
  annotationId: string;
  /** The AI's replacement text. */
  suggestedText: string;
  /** Text the suggestion was authored against (the row's `selectedText`). */
  expectedText: string;
}

export interface ApplyPlanEntry {
  annotationId: string;
  from: number;
  to: number;
  /** What the document says right now — the source of truth for confirmation. */
  currentText: string;
  newText: string;
  needsConfirm: boolean;
}

/**
 * Has the underlying text drifted enough to ask the user first?
 *
 * Compared through `normalizeSameLength` so a smart-quote or en-dash
 * autocorrect — which changes bytes but not meaning, and which the resolver
 * already normalized past when anchoring — does not raise a spurious
 * "this text has changed" prompt on every apply.
 */
export function shouldConfirmApply(
  currentText: string,
  expectedText: string
): boolean {
  return normalizeSameLength(currentText) !== normalizeSameLength(expectedText);
}

/**
 * Resolve targets against the CURRENT doc and drop the ones we refuse to touch.
 *
 * Must be called immediately before dispatching: any await in between (a
 * mutation round-trip, a confirmation dialog the user leaves open) is an
 * arbitrary-length window in which the document can move.
 *
 * Targets whose range is `split` or `missing` are omitted entirely — callers
 * detect this as `entries.length < targets.length` and report the skip. Drift
 * is NOT a skip: it is surfaced via `needsConfirm` so the user can decide.
 */
export function planApply(doc: PMNode, targets: ApplyTarget[]): ApplyPlanEntry[] {
  const ranges = findAnnotationRanges(
    doc,
    targets.map((t) => t.annotationId)
  );

  const entries: ApplyPlanEntry[] = [];
  for (const target of targets) {
    const found = ranges.get(target.annotationId);
    if (!found || found.status !== "single") continue;

    entries.push({
      annotationId: target.annotationId,
      from: found.from,
      to: found.to,
      currentText: found.text,
      newText: target.suggestedText,
      needsConfirm: shouldConfirmApply(found.text, target.expectedText),
    });
  }

  return entries;
}

/**
 * Stage every replacement onto one transform. Mutates `tr`; returns the count.
 *
 * One transform dispatched once means one undo step, so a mis-fired "apply all"
 * is a single Cmd+Z rather than fifty.
 */
export function buildApplyTransaction(
  tr: Transform,
  schema: Schema,
  entries: ApplyPlanEntry[]
): number {
  // Descending: see invariant 2 in the module header. Do not "fix" this to
  // ascending without adding tr.mapping — the tests will catch you, but the
  // user's document is what is actually at stake.
  const ordered = [...entries].sort((a, b) => b.from - a.from);

  let applied = 0;
  for (const entry of ordered) {
    if (entry.newText.length === 0) {
      // schema.text("") throws; a deletion is the correct empty replacement.
      tr.delete(entry.from, entry.to);
    } else {
      tr.replaceWith(entry.from, entry.to, schema.text(entry.newText));
    }
    applied++;
  }

  return applied;
}
