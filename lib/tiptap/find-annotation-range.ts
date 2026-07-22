/**
 * Locate the live ProseMirror range(s) carrying a given annotation id.
 *
 * Stored `from`/`to` on the annotation row are a fallback, not the truth: the
 * user edits the document after a suggestion is created, and only the mark
 * itself moves with the text. Every operation that touches the document —
 * scroll-to, and above all "apply fix" — must re-derive positions from marks.
 *
 * The important output is `split`. ProseMirror gives no guarantee that one
 * annotation id occupies one contiguous run: the user can type unmarked text
 * into the middle of a highlight, or a paste can duplicate the mark elsewhere.
 * Reporting the outer bounds of such a mess (what the panel's old inline walk
 * did) yields a range containing text the annotation never covered — harmless
 * when merely selecting, destructive when replacing. So `split` and `missing`
 * both refuse: a refused apply costs one manual edit, a wrong apply eats the
 * user's writing.
 */

import type { Node as PMNode } from "@tiptap/pm/model";

export interface RangeRun {
  from: number;
  to: number;
}

export type FoundRange =
  | { status: "single"; from: number; to: number; text: string }
  | { status: "split"; runs: RangeRun[] }
  | { status: "missing" };

/**
 * Group a document's annotation marks into positionally-contiguous runs.
 *
 * Contiguity is tested as `last.to === start` — positional, not structural.
 * That distinction is the whole point: `brave <strong>new</strong> world`
 * under one annotation is three text nodes, but they abut exactly, so they
 * merge into one run. A genuine gap means unmarked characters intervene.
 */
function collectRuns(doc: PMNode, wanted: Set<string>): Map<string, RangeRun[]> {
  const runs = new Map<string, RangeRun[]>();

  doc.descendants((node, pos) => {
    if (!node.isText) return true;

    for (const mark of node.marks) {
      if (mark.type.name !== "annotation") continue;

      const id = mark.attrs.annotationId;
      if (typeof id !== "string" || !wanted.has(id)) continue;

      const start = pos;
      const end = pos + node.nodeSize;
      const existing = runs.get(id);

      if (!existing) {
        runs.set(id, [{ from: start, to: end }]);
      } else {
        const last = existing[existing.length - 1];
        if (last.to === start) {
          last.to = end;
        } else {
          existing.push({ from: start, to: end });
        }
      }
    }

    return true;
  });

  return runs;
}

function classify(doc: PMNode, runs: RangeRun[] | undefined): FoundRange {
  if (!runs || runs.length === 0) return { status: "missing" };
  if (runs.length > 1) return { status: "split", runs };

  const { from, to } = runs[0];
  return { status: "single", from, to, text: doc.textBetween(from, to) };
}

/** Locate a single annotation id. */
export function findAnnotationRange(doc: PMNode, annotationId: string): FoundRange {
  const runs = collectRuns(doc, new Set([annotationId]));
  return classify(doc, runs.get(annotationId));
}

/**
 * Locate many annotation ids in ONE document walk.
 *
 * Apply-all would otherwise walk the doc once per suggestion; with 50
 * suggestions on a long script that is 50 full traversals for information a
 * single pass already has.
 */
export function findAnnotationRanges(
  doc: PMNode,
  ids: string[]
): Map<string, FoundRange> {
  const wanted = new Set(ids);
  const runs = collectRuns(doc, wanted);

  const out = new Map<string, FoundRange>();
  for (const id of wanted) {
    out.set(id, classify(doc, runs.get(id)));
  }
  return out;
}
