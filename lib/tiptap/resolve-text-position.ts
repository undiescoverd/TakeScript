/**
 * Maps AI-quoted text back to ProseMirror positions against the LIVE editor doc.
 *
 * This is deliberately client-only. The Convex action sees only `script.content`
 * (last saved), which under collaboration is not authoritative — the Yjs doc in
 * the browser is. And the action's `extractPlainText` is lossy: it uppercases
 * headings and injects `[SCREEN RECORDING]` markers and bullet prefixes, so its
 * character offsets have no relationship to ProseMirror positions. Nothing here
 * may ever run server-side.
 */

import type { Node as PMNode } from "@tiptap/pm/model";

export interface DocIndexSegment {
  /** Offset of this segment's first char within the flattened text. */
  textStart: number;
  /** ProseMirror position of that first char, or -1 for a block-break sentinel. */
  pmPos: number;
  len: number;
}

export interface DocIndex {
  text: string;
  segs: DocIndexSegment[];
}

export type ResolveFailure =
  | "too-short"
  | "not-found"
  | "ambiguous"
  | "crosses-block"
  | "no-quote";

export type ResolveResult =
  | { ok: true; from: number; to: number }
  | { ok: false; reason: ResolveFailure };

/**
 * Normalize characters that models silently rewrite, WITHOUT changing length.
 *
 * Every substitution here is strictly 1 char -> 1 char. Collapsing whitespace
 * runs or trimming would change the string length and desynchronize the
 * offset->position map, silently shifting every mark after the first collapse.
 * If you add a rule to this function, it must preserve length.
 */
export function normalizeSameLength(s: string): string {
  let out = "";
  for (const ch of s) {
    switch (ch) {
      case "‘": // ' left single quote
      case "’": // ' right single quote
      case "‛":
      case "′": // prime
        out += "'";
        break;
      case "“": // " left double quote
      case "”": // " right double quote
      case "‟":
      case "″": // double prime
        out += '"';
        break;
      case " ": // non-breaking space
      case " ":
      case " ":
      case " ": // thin space
        out += " ";
        break;
      case "–": // en dash
      case "—": // em dash
      case "−": // minus sign
        out += "-";
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/**
 * Flatten the document to text while recording, for each run, where its first
 * character lives in ProseMirror coordinates.
 *
 * Block boundaries become a one-char "\n" sentinel with pmPos -1. That both
 * enforces "a quote may not span a line break" and stops a needle from silently
 * matching across two unrelated paragraphs.
 */
export function buildDocIndex(doc: PMNode): DocIndex {
  let text = "";
  const segs: DocIndexSegment[] = [];

  doc.descendants((node, pos) => {
    if (node.isText) {
      const raw = node.text ?? "";
      segs.push({ textStart: text.length, pmPos: pos, len: raw.length });
      text += normalizeSameLength(raw);
    } else if (node.isBlock && text.length > 0 && !text.endsWith("\n")) {
      segs.push({ textStart: text.length, pmPos: -1, len: 1 });
      text += "\n";
    }
    return true;
  });

  return { text, segs };
}

/** Binary search for the segment containing `offset`. */
function segmentAt(segs: DocIndexSegment[], offset: number): DocIndexSegment | null {
  let lo = 0;
  let hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segs[mid];
    if (offset < seg.textStart) {
      hi = mid - 1;
    } else if (offset >= seg.textStart + seg.len) {
      lo = mid + 1;
    } else {
      return seg;
    }
  }
  return null;
}

/** Map a flattened-text offset to a ProseMirror position, or null if unmappable. */
export function textOffsetToPmPos(index: DocIndex, offset: number): number | null {
  const seg = segmentAt(index.segs, offset);
  if (!seg || seg.pmPos === -1) return null;
  return seg.pmPos + (offset - seg.textStart);
}

/**
 * All non-overlapping occurrences of `needle`.
 *
 * Non-overlapping matches how a model counts "the 2nd time this appears".
 * For prose spans of 3+ chars, overlapping matches effectively never arise.
 */
function allIndexesOf(haystack: string, needle: string): number[] {
  const hits: number[] = [];
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    hits.push(i);
    i = haystack.indexOf(needle, i + needle.length);
  }
  return hits;
}

function commonSuffixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) {
    n++;
  }
  return n;
}

function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) {
    n++;
  }
  return n;
}

const MIN_NEEDLE_LEN = 3;
const CONTEXT_WINDOW = 60;
/** Context agreement below this is too weak to override `occurrence`. */
const CONTEXT_MIN_SCORE = 8;

/**
 * Resolve a model-quoted span to a ProseMirror range.
 *
 * Matching is exact (after same-length normalization) by design — fuzzy
 * matching is explicitly out of scope, because a near-miss anchor puts the
 * highlight on the wrong words, which is worse than no anchor at all.
 *
 * `searchWindow` restricts matching to a slice of the flattened text; the
 * selection-only trigger uses it so a phrase recurring elsewhere in the
 * document cannot mis-anchor.
 */
export function resolveSpan(
  index: DocIndex,
  originalText: string,
  occurrence?: number,
  contextBefore?: string,
  contextAfter?: string,
  searchWindow?: { start: number; end: number }
): ResolveResult {
  const needle = normalizeSameLength(originalText ?? "");

  if (needle.trim().length < MIN_NEEDLE_LEN) {
    return { ok: false, reason: "too-short" };
  }
  // Rule 3: a quote may not span a line break. The flattened text contains
  // "\n" only at block sentinels, so this is an exact test for it.
  if (needle.includes("\n")) {
    return { ok: false, reason: "crosses-block" };
  }

  let hits = allIndexesOf(index.text, needle);
  if (searchWindow) {
    hits = hits.filter(
      (h) => h >= searchWindow.start && h + needle.length <= searchWindow.end
    );
  }

  if (hits.length === 0) {
    return { ok: false, reason: "not-found" };
  }

  let chosen: number;
  if (hits.length === 1) {
    chosen = hits[0];
  } else {
    const before = normalizeSameLength(contextBefore ?? "");
    const after = normalizeSameLength(contextAfter ?? "");

    const scored = hits
      .map((h) => ({
        h,
        score:
          commonSuffixLen(index.text.slice(Math.max(0, h - CONTEXT_WINDOW), h), before) +
          commonPrefixLen(
            index.text.slice(h + needle.length, h + needle.length + CONTEXT_WINDOW),
            after
          ),
      }))
      .sort((a, b) => b.score - a.score);

    if (
      scored[0].score >= CONTEXT_MIN_SCORE &&
      scored[0].score > scored[1].score
    ) {
      chosen = scored[0].h; // context is decisive
    } else if (occurrence !== undefined && occurrence >= 1 && occurrence <= hits.length) {
      chosen = hits[occurrence - 1];
    } else {
      return { ok: false, reason: "ambiguous" };
    }
  }

  const from = textOffsetToPmPos(index, chosen);
  const lastChar = textOffsetToPmPos(index, chosen + needle.length - 1);
  if (from === null || lastChar === null) {
    return { ok: false, reason: "crosses-block" };
  }

  // ProseMirror ranges are end-exclusive.
  return { ok: true, from, to: lastChar + 1 };
}

/**
 * Demote any span overlapping one already accepted.
 *
 * Two overlapping marks make "apply fix" ill-defined — the ranges would fight
 * over the same characters — so later overlappers are kept as unanchored notes
 * rather than silently dropped.
 */
export function dropOverlaps<T>(
  resolved: Array<{ item: T; result: ResolveResult }>
): Array<{ item: T; result: ResolveResult }> {
  const accepted: Array<{ from: number; to: number }> = [];

  // Walk in document order so the earliest span wins a conflict.
  const order = resolved
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => {
      const af = a.entry.result.ok ? a.entry.result.from : Number.MAX_SAFE_INTEGER;
      const bf = b.entry.result.ok ? b.entry.result.from : Number.MAX_SAFE_INTEGER;
      return af - bf || a.i - b.i;
    });

  const demoted = new Set<number>();
  for (const { entry, i } of order) {
    if (!entry.result.ok) continue;
    const { from, to } = entry.result;
    if (accepted.some((a) => from < a.to && a.from < to)) {
      demoted.add(i);
    } else {
      accepted.push({ from, to });
    }
  }

  return resolved.map((entry, i) =>
    demoted.has(i)
      ? { item: entry.item, result: { ok: false, reason: "ambiguous" as const } }
      : entry
  );
}
