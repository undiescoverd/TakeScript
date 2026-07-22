import { describe, it, expect } from "vitest";
import { Schema, Node as PMNode } from "@tiptap/pm/model";
import {
  buildSuggestionBatch,
  MAX_SUGGESTIONS_PER_BATCH,
  type AIIssue,
} from "./build-suggestion-batch";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
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

function issue(over: Partial<AIIssue> = {}): AIIssue {
  return {
    type: "grammar",
    message: "Something is off here.",
    suggestion: "fixed",
    severity: "medium",
    ...over,
  };
}

describe("buildSuggestionBatch", () => {
  it("anchors a resolvable quote and emits a matching mark", () => {
    const doc = docOf("The quick brown fox jumps.");
    const batch = buildSuggestionBatch(doc, [
      issue({ originalText: "quick brown", suggestion: "swift tan" }),
    ]);

    expect(batch.stats).toMatchObject({ total: 1, anchored: 1 });
    expect(batch.suggestions[0]).toMatchObject({
      anchored: true,
      selectedText: "quick brown",
      suggestedText: "swift tan",
      suggestionType: "grammar",
      severity: "medium",
    });

    expect(batch.marks).toHaveLength(1);
    expect(batch.marks[0].index).toBe(0);
    const { from, to } = batch.marks[0];
    expect(doc.textBetween(from, to)).toBe("quick brown");
  });

  it("keeps unanchored issues as general notes rather than dropping them", () => {
    const doc = docOf("The quick brown fox jumps.");
    const batch = buildSuggestionBatch(doc, [
      issue({ originalText: "quick brown" }),
      // No quote at all — prompt rule 6 permits this.
      issue({ message: "Pacing drags in the middle." }),
      // A quote that simply is not in the document.
      issue({ originalText: "lazy purple dog" }),
    ]);

    expect(batch.stats.total).toBe(3);
    expect(batch.stats.anchored).toBe(1);
    expect(batch.stats.failures["no-quote"]).toBe(1);
    expect(batch.stats.failures["not-found"]).toBe(1);

    expect(batch.suggestions[1].anchored).toBe(false);
    expect(batch.suggestions[1].from).toBe(0);
    expect(batch.suggestions[1].to).toBe(0);
    // Only the anchored row produced a mark, and it points back at index 0.
    expect(batch.marks.map((m) => m.index)).toEqual([0]);
  });

  it("strips suggestedText from unanchored rows (nothing to apply it to)", () => {
    const doc = docOf("Hello world.");
    const batch = buildSuggestionBatch(doc, [
      issue({ message: "General note", suggestion: "some replacement" }),
    ]);

    expect(batch.suggestions[0].anchored).toBe(false);
    expect(batch.suggestions[0].suggestedText).toBeUndefined();
  });

  it('maps suggestion: "" to suggestedText: undefined (comment-only)', () => {
    const doc = docOf("The quick brown fox jumps.");
    const batch = buildSuggestionBatch(doc, [
      issue({ originalText: "quick brown", suggestion: "" }),
    ]);

    expect(batch.suggestions[0].anchored).toBe(true);
    expect(batch.suggestions[0].suggestedText).toBeUndefined();
  });

  it("stores the LIVE doc text, not the model's quote", () => {
    // The model echoes the quote with smart punctuation; the resolver matches
    // through normalization, but the row must record what the doc really says.
    const doc = docOf("She said don't stop believing.");
    const batch = buildSuggestionBatch(doc, [
      issue({ originalText: "don’t stop" }),
    ]);

    expect(batch.suggestions[0].anchored).toBe(true);
    expect(batch.suggestions[0].selectedText).toBe("don't stop");
    expect(batch.suggestions[0].selectedText).not.toBe("don’t stop");
  });

  it("demotes the later of two overlapping issues to unanchored", () => {
    const doc = docOf("The quick brown fox jumps over it.");
    const batch = buildSuggestionBatch(doc, [
      issue({ originalText: "quick brown fox" }),
      issue({ originalText: "brown fox jumps" }),
    ]);

    expect(batch.stats.anchored).toBe(1);
    expect(batch.suggestions[0].anchored).toBe(true);
    expect(batch.suggestions[1].anchored).toBe(false);
    expect(batch.marks.map((m) => m.index)).toEqual([0]);
  });

  it("preserves input order so marks[i].index zips against returned ids", () => {
    const doc = docOf("alpha beta gamma delta epsilon");
    const issues = [
      issue({ message: "m0" }), // unanchored
      issue({ message: "m1", originalText: "gamma" }),
      issue({ message: "m2", originalText: "nowhere" }), // unanchored
      issue({ message: "m3", originalText: "alpha" }),
    ];
    const batch = buildSuggestionBatch(doc, issues);

    expect(batch.suggestions.map((s) => s.content)).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
    ]);
    // Marks reference positions by ORIGINAL index, even though "alpha" comes
    // earlier in the document than "gamma".
    expect(batch.marks.map((m) => m.index)).toEqual([1, 3]);
    const byIndex = new Map(batch.marks.map((m) => [m.index, m]));
    expect(doc.textBetween(byIndex.get(1)!.from, byIndex.get(1)!.to)).toBe("gamma");
    expect(doc.textBetween(byIndex.get(3)!.from, byIndex.get(3)!.to)).toBe("alpha");
  });

  it("caps the batch at 50 so the mutation's limit can never throw", () => {
    const doc = docOf("word ".repeat(200).trim());
    const issues = Array.from({ length: 80 }, (_, i) =>
      issue({ message: `note ${i}` })
    );
    const batch = buildSuggestionBatch(doc, issues);

    expect(batch.suggestions).toHaveLength(MAX_SUGGESTIONS_PER_BATCH);
    expect(batch.stats.total).toBe(MAX_SUGGESTIONS_PER_BATCH);
  });

  it("honours a lower explicit max but never exceeds the hard cap", () => {
    const doc = docOf("Hello world.");
    const issues = Array.from({ length: 80 }, () => issue());

    expect(buildSuggestionBatch(doc, issues, { max: 5 }).suggestions).toHaveLength(5);
    expect(
      buildSuggestionBatch(doc, issues, { max: 999 }).suggestions
    ).toHaveLength(MAX_SUGGESTIONS_PER_BATCH);
  });

  it("restricts matching to searchWindow (selection-only trigger)", () => {
    const doc = docOf("target here", "and target there");
    const full = buildSuggestionBatch(doc, [
      issue({ originalText: "target", occurrence: 2 }),
    ]);
    expect(full.stats.anchored).toBe(1);

    // Window covering only the SECOND paragraph's occurrence.
    const secondStart = "target here\n".length;
    const windowed = buildSuggestionBatch(doc, [issue({ originalText: "target" })], {
      searchWindow: { start: secondStart, end: 1000 },
    });
    expect(windowed.stats.anchored).toBe(1);
    expect(doc.textBetween(windowed.marks[0].from, windowed.marks[0].to)).toBe(
      "target"
    );
    expect(windowed.marks[0].from).toBeGreaterThan(full.marks[0].from - 100);
  });

  it("counts crosses-block failures for quotes spanning a paragraph break", () => {
    const doc = docOf("first paragraph", "second paragraph");
    const batch = buildSuggestionBatch(doc, [
      issue({ originalText: "paragraph second" }),
    ]);
    expect(batch.stats.anchored).toBe(0);
    expect(batch.stats.failures["not-found"]).toBe(1);
  });

  it("returns an empty, well-formed batch for no issues", () => {
    const batch = buildSuggestionBatch(docOf("Hello."), []);
    expect(batch.suggestions).toEqual([]);
    expect(batch.marks).toEqual([]);
    expect(batch.stats.total).toBe(0);
    expect(batch.stats.anchored).toBe(0);
  });

  it("every mark's range matches its suggestion's stored from/to", () => {
    const doc = docOf("alpha beta gamma", "delta epsilon zeta");
    const batch = buildSuggestionBatch(doc, [
      issue({ originalText: "beta" }),
      issue({ originalText: "epsilon" }),
      issue({ originalText: "absent" }),
    ]);

    for (const mark of batch.marks) {
      const s = batch.suggestions[mark.index];
      expect(s.anchored).toBe(true);
      expect(s.from).toBe(mark.from);
      expect(s.to).toBe(mark.to);
      expect(doc.textBetween(mark.from, mark.to)).toBe(s.selectedText);
    }
  });
});
