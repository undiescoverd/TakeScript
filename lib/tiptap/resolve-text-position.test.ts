import { describe, it, expect } from "vitest";
import { Schema, Node as PMNode } from "@tiptap/pm/model";
import {
  buildDocIndex,
  resolveSpan,
  normalizeSameLength,
  textOffsetToPmPos,
  dropOverlaps,
  type ResolveResult,
} from "./resolve-text-position";

// Minimal doc/paragraph/text schema — enough for real ProseMirror positions,
// which is the whole point: hand-built fake positions would test nothing.
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    heading: { group: "block", content: "inline*", toDOM: () => ["h1", 0] },
    text: { group: "inline" },
  },
});

function docOf(...paragraphs: string[]): PMNode {
  return schema.node(
    "doc",
    null,
    paragraphs.map((t) =>
      schema.node("paragraph", null, t ? [schema.text(t)] : [])
    )
  );
}

/** Ground truth: what ProseMirror itself says lives in [from, to). */
function sliceOf(doc: PMNode, r: ResolveResult): string {
  if (!r.ok) throw new Error("expected ok");
  return doc.textBetween(r.from, r.to);
}

describe("normalizeSameLength", () => {
  it("is strictly length-preserving (the critical invariant)", () => {
    const samples = [
      "don’t “quote” me — really",
      "a b c",
      "en–dash and em—dash",
      "plain ascii",
      "  leading and trailing  ",
      "multiple   internal   spaces",
    ];
    for (const s of samples) {
      expect(normalizeSameLength(s).length).toBe(s.length);
    }
  });

  it("does not collapse whitespace runs or trim", () => {
    expect(normalizeSameLength("  a   b  ")).toBe("  a   b  ");
  });

  it("maps smart punctuation to ascii", () => {
    expect(normalizeSameLength("don’t “x” – y")).toBe("don't \"x\" - y");
  });
});

describe("buildDocIndex", () => {
  it("joins blocks with a newline and maps offsets to real PM positions", () => {
    const doc = docOf("Hello world", "Second para");
    const index = buildDocIndex(doc);
    expect(index.text).toBe("Hello world\nSecond para");

    // Round-trip every character offset through PM and back.
    for (let i = 0; i < index.text.length; i++) {
      if (index.text[i] === "\n") {
        expect(textOffsetToPmPos(index, i)).toBeNull();
        continue;
      }
      const pos = textOffsetToPmPos(index, i)!;
      expect(doc.textBetween(pos, pos + 1)).toBe(index.text[i]);
    }
  });

  it("handles empty leading paragraphs without a stray newline", () => {
    const doc = docOf("", "text");
    expect(buildDocIndex(doc).text).toBe("text");
  });
});

describe("resolveSpan", () => {
  it("resolves a unique span to the exact text", () => {
    const doc = docOf("The quick brown fox jumps");
    const index = buildDocIndex(doc);
    const r = resolveSpan(index, "brown fox");
    expect(r.ok).toBe(true);
    expect(sliceOf(doc, r)).toBe("brown fox");
  });

  it("uses occurrence to pick the 2nd of three identical phrases", () => {
    const doc = docOf("alpha repeat beta", "gamma repeat delta", "eps repeat zeta");
    const index = buildDocIndex(doc);

    const second = resolveSpan(index, "repeat", 2);
    expect(second.ok).toBe(true);
    // Must land in the *second* paragraph: check surrounding context.
    const s = second as { ok: true; from: number; to: number };
    expect(doc.textBetween(s.from - 6, s.to + 6)).toBe("gamma repeat delta");

    const third = resolveSpan(index, "repeat", 3);
    const t = third as { ok: true; from: number; to: number };
    expect(doc.textBetween(t.from - 4, t.to + 5)).toBe("eps repeat zeta");
  });

  it("lets strong context override occurrence", () => {
    const doc = docOf("first the target here", "second the target here");
    const index = buildDocIndex(doc);
    // occurrence says 1, but context clearly points at the second.
    const r = resolveSpan(index, "the target", 1, "second ", " here");
    const s = r as { ok: true; from: number; to: number };
    expect(doc.textBetween(s.from - 7, s.to)).toBe("second the target");
  });

  it("resolves text the model re-quoted with curly punctuation", () => {
    const doc = docOf("It’s a “test” of dashes—here");
    const index = buildDocIndex(doc);
    // Model returns ascii; doc has smart chars. Same length, so it anchors.
    const r = resolveSpan(index, "It's a \"test\"");
    expect(r.ok).toBe(true);
    expect(sliceOf(doc, r)).toBe("It’s a “test”");
  });

  it("refuses a span crossing a paragraph break rather than mis-anchoring", () => {
    const doc = docOf("ends here", "starts there");
    const index = buildDocIndex(doc);
    const r = resolveSpan(index, "ends here\nstarts there");
    expect(r).toEqual({ ok: false, reason: "crosses-block" });
  });

  it("reports not-found for a paraphrase", () => {
    const doc = docOf("The quick brown fox");
    const r = resolveSpan(buildDocIndex(doc), "the speedy brown fox");
    expect(r).toEqual({ ok: false, reason: "not-found" });
  });

  it("reports too-short and ambiguous", () => {
    const doc = docOf("ab repeat cd repeat ef");
    const index = buildDocIndex(doc);
    expect(resolveSpan(index, "ab").ok).toBe(false);
    // Two hits, no usable context, out-of-range occurrence.
    expect(resolveSpan(index, "repeat", 9)).toEqual({
      ok: false,
      reason: "ambiguous",
    });
  });

  it("honours a search window so a selection cannot mis-anchor", () => {
    const doc = docOf("repeat outside", "repeat inside");
    const index = buildDocIndex(doc);
    const start = index.text.indexOf("\n") + 1;
    const r = resolveSpan(index, "repeat", undefined, undefined, undefined, {
      start,
      end: index.text.length,
    });
    const s = r as { ok: true; from: number; to: number };
    expect(doc.textBetween(s.from, s.to + 7)).toBe("repeat inside");
  });

  it("anchors correctly after multi-space runs (off-by-N regression)", () => {
    // If normalization collapsed these runs, every later span would shift.
    const doc = docOf("a   b     c target end");
    const index = buildDocIndex(doc);
    const r = resolveSpan(index, "target");
    expect(sliceOf(doc, r)).toBe("target");
  });
});

describe("dropOverlaps", () => {
  it("demotes the later of two overlapping spans, keeping the earlier", () => {
    const entries = [
      { item: "a", result: { ok: true, from: 10, to: 20 } as ResolveResult },
      { item: "b", result: { ok: true, from: 15, to: 25 } as ResolveResult },
      { item: "c", result: { ok: true, from: 30, to: 40 } as ResolveResult },
    ];
    const out = dropOverlaps(entries);
    expect(out[0].result.ok).toBe(true);
    expect(out[1].result.ok).toBe(false); // overlaps a
    expect(out[2].result.ok).toBe(true);
  });

  it("treats touching-but-not-overlapping spans as compatible", () => {
    const out = dropOverlaps([
      { item: "a", result: { ok: true, from: 0, to: 5 } as ResolveResult },
      { item: "b", result: { ok: true, from: 5, to: 9 } as ResolveResult },
    ]);
    expect(out.every((o) => o.result.ok)).toBe(true);
  });

  it("preserves input order and leaves failures untouched", () => {
    const out = dropOverlaps([
      { item: "x", result: { ok: false, reason: "not-found" } as ResolveResult },
      { item: "y", result: { ok: true, from: 1, to: 3 } as ResolveResult },
    ]);
    expect(out.map((o) => o.item)).toEqual(["x", "y"]);
    expect(out[0].result).toEqual({ ok: false, reason: "not-found" });
  });
});
