import { describe, it, expect } from "vitest";
import {
  suggestionEligibility,
  selectNewestBatchTargets,
  type SuggestionRow,
} from "./suggestion-selectors";

/** A minimal AI row; override per case. */
function aiRow(over: Partial<SuggestionRow> = {}): SuggestionRow {
  return {
    authorType: "ai",
    anchored: true,
    suggestedText: "fixed",
    resolved: false,
    batchId: "b1",
    createdAt: 1,
    ...over,
  };
}

describe("suggestionEligibility", () => {
  it("an anchored AI row with replacement text can be applied", () => {
    const e = suggestionEligibility(aiRow());
    expect(e).toMatchObject({ isAI: true, isUnanchored: false, canApply: true });
  });

  it("an unanchored AI row is flagged and cannot be applied", () => {
    const e = suggestionEligibility(aiRow({ anchored: false, suggestedText: undefined }));
    expect(e.isUnanchored).toBe(true);
    expect(e.canApply).toBe(false);
  });

  it("an anchored AI row with no replacement text (advice only) cannot be applied", () => {
    expect(suggestionEligibility(aiRow({ suggestedText: undefined })).canApply).toBe(false);
    expect(suggestionEligibility(aiRow({ suggestedText: "" })).canApply).toBe(false);
  });

  it("an already-resolved AI row cannot be applied again", () => {
    expect(suggestionEligibility(aiRow({ resolved: true })).canApply).toBe(false);
  });

  it("a human annotation is never an AI row and never applicable", () => {
    const e = suggestionEligibility({
      authorType: "user",
      resolved: false,
      createdAt: 1,
    });
    expect(e).toMatchObject({ isAI: false, isUnanchored: false, canApply: false });
  });
});

describe("selectNewestBatchTargets", () => {
  it("returns only the anchored, replacement-bearing rows of the newest batch", () => {
    const rows: SuggestionRow[] = [
      aiRow({ batchId: "old", createdAt: 10 }),
      aiRow({ batchId: "new", createdAt: 20 }),
      aiRow({ batchId: "new", createdAt: 21, anchored: false, suggestedText: undefined }),
      aiRow({ batchId: "new", createdAt: 22, suggestedText: undefined }),
    ];
    const picked = selectNewestBatchTargets(rows);
    expect(picked).toHaveLength(1);
    expect(picked[0].batchId).toBe("new");
    expect(picked[0].createdAt).toBe(20);
  });

  it("ignores human annotations entirely", () => {
    const rows: SuggestionRow[] = [
      { authorType: "user", resolved: false, createdAt: 100 },
      aiRow({ batchId: "b1", createdAt: 5 }),
    ];
    const picked = selectNewestBatchTargets(rows);
    expect(picked).toHaveLength(1);
    expect(picked[0].batchId).toBe("b1");
  });

  it("returns nothing when there are no AI rows", () => {
    expect(
      selectNewestBatchTargets([
        { authorType: "user", resolved: false, createdAt: 1 },
      ])
    ).toEqual([]);
  });
});
