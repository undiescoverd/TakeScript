import { describe, it, expect } from "vitest";
import { Schema, Node as PMNode } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";
import {
  planApply,
  shouldConfirmApply,
  buildApplyTransaction,
  type ApplyTarget,
  type ApplyPlanEntry,
} from "./apply-suggestion";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    text: { group: "inline" },
  },
  marks: {
    annotation: {
      attrs: { annotationId: {}, color: { default: "ai" } },
      toDOM: () => ["span", 0],
    },
    strong: { toDOM: () => ["strong", 0] },
  },
});

const ann = (id: string) => schema.marks.annotation.create({ annotationId: id });

function para(...parts: Array<string | [string, ReturnType<typeof ann>[]]>) {
  return schema.node(
    "paragraph",
    null,
    parts.map((p) =>
      typeof p === "string" ? schema.text(p) : schema.text(p[0], p[1])
    )
  );
}

function docOf(...paragraphs: PMNode[]): PMNode {
  return schema.node("doc", null, paragraphs);
}

/** Does any text in [from, to) still carry an annotation mark? */
function hasAnnotationMark(doc: PMNode, from: number, to: number): boolean {
  let found = false;
  doc.nodesBetween(from, to, (node) => {
    if (node.isText && node.marks.some((m) => m.type.name === "annotation")) {
      found = true;
    }
    return true;
  });
  return found;
}

describe("shouldConfirmApply", () => {
  it("does not prompt when the text is identical", () => {
    expect(shouldConfirmApply("the quick fox", "the quick fox")).toBe(false);
  });

  it("does not prompt for a smart-quote-only difference", () => {
    // An autocorrect turning ' into ' must not read as "the user edited this".
    expect(shouldConfirmApply("don't stop", "don’t stop")).toBe(false);
    expect(shouldConfirmApply('say "hi" — now', 'say “hi” – now')).toBe(false);
  });

  it("prompts when the user genuinely edited the text", () => {
    expect(shouldConfirmApply("the quick brown fox", "the quick fox")).toBe(true);
    expect(shouldConfirmApply("", "the quick fox")).toBe(true);
  });
});

describe("planApply", () => {
  const doc = docOf(
    para("A ", ["teh", [ann("a1")]], " cat and ", ["recieve", [ann("a2")]], " it")
  );

  it("plans entries for resolvable single ranges", () => {
    const targets: ApplyTarget[] = [
      { annotationId: "a1", suggestedText: "the", expectedText: "teh" },
      { annotationId: "a2", suggestedText: "receive", expectedText: "recieve" },
    ];
    const entries = planApply(doc, targets);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      annotationId: "a1",
      currentText: "teh",
      newText: "the",
      needsConfirm: false,
    });
    expect(doc.textBetween(entries[0].from, entries[0].to)).toBe("teh");
  });

  it("skips missing annotations", () => {
    const entries = planApply(doc, [
      { annotationId: "ghost", suggestedText: "x", expectedText: "y" },
    ]);
    expect(entries).toHaveLength(0);
  });

  it("skips split annotations rather than replacing the spanning range", () => {
    const splitDoc = docOf(
      para(["one", [ann("s1")]], " UNRELATED ", ["two", [ann("s1")]])
    );
    const entries = planApply(splitDoc, [
      { annotationId: "s1", suggestedText: "replacement", expectedText: "one two" },
    ]);
    expect(entries).toHaveLength(0);
  });

  it("flags drift for confirmation instead of skipping it", () => {
    const entries = planApply(doc, [
      // The user rewrote the span since the suggestion was made.
      { annotationId: "a1", suggestedText: "the", expectedText: "something else" },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].needsConfirm).toBe(true);
  });
});

describe("buildApplyTransaction", () => {
  /** Three marked spans of differing lengths across two paragraphs. */
  function threeSpanDoc(): PMNode {
    return docOf(
      para("I ", ["definately", [ann("a1")]], " went ", ["their", [ann("a2")]], " today"),
      para("We ", ["recieved", [ann("a3")]], " it")
    );
  }

  const targets: ApplyTarget[] = [
    // SHORTER than the original — shifts every later position left by 4.
    // This length delta is what makes the ascending-order test meaningful; a
    // length-neutral replacement would let front-to-back order pass by luck.
    { annotationId: "a1", suggestedText: "surely", expectedText: "definately" },
    { annotationId: "a2", suggestedText: "there", expectedText: "their" },
    // Longer than the original — shifts everything after it right.
    { annotationId: "a3", suggestedText: "have received", expectedText: "recieved" },
  ];

  it("applies three replacements of differing lengths in one transaction", () => {
    const doc = threeSpanDoc();
    const entries = planApply(doc, targets);
    expect(entries).toHaveLength(3);

    const tr = new Transform(doc);
    const count = buildApplyTransaction(tr, schema, entries);

    expect(count).toBe(3);
    expect(tr.doc.textContent).toBe(
      "I surely went there todayWe have received it"
    );
  });

  it("leaves NO annotation mark on the replacement text", () => {
    // The central mark-inheritance check. Tiptap marks are inclusive by
    // default, so insertContent would extend the highlight over the new text.
    // replaceWith(schema.text(...)) inserts a bare text node instead.
    const doc = threeSpanDoc();
    const tr = new Transform(doc);
    buildApplyTransaction(tr, schema, planApply(doc, targets));

    const start = tr.doc.textContent.indexOf("surely");
    expect(start).toBeGreaterThan(-1);
    expect(hasAnnotationMark(tr.doc, 1, tr.doc.content.size)).toBe(false);
  });

  it("is order-independent in its input (it sorts internally)", () => {
    const doc = threeSpanDoc();
    const entries = planApply(doc, targets);

    const forward = new Transform(doc);
    buildApplyTransaction(forward, schema, [...entries]);

    const shuffled = new Transform(doc);
    buildApplyTransaction(shuffled, schema, [entries[2], entries[0], entries[1]]);

    expect(shuffled.doc.textContent).toBe(forward.doc.textContent);
  });

  // Proves the descending-order requirement is real, not cargo-culted: the
  // same entries applied front-to-back against stale coordinates corrupt the doc.
  it("would corrupt the document if applied ascending", () => {
    const doc = threeSpanDoc();
    const entries = planApply(doc, targets);

    const ascending = new Transform(doc);
    for (const e of [...entries].sort((a, b) => a.from - b.from)) {
      ascending.replaceWith(e.from, e.to, schema.text(e.newText));
    }

    const correct = new Transform(doc);
    buildApplyTransaction(correct, schema, entries);

    expect(correct.doc.textContent).toBe(
      "I surely went there todayWe have received it"
    );
    expect(ascending.doc.textContent).not.toBe(correct.doc.textContent);
  });

  it("deletes the range when the suggestion is an empty string", () => {
    // schema.text("") throws in ProseMirror, so this path must use delete.
    const doc = docOf(para("Keep ", ["really ", [ann("a1")]], "this"));
    const entries = planApply(doc, [
      { annotationId: "a1", suggestedText: "", expectedText: "really " },
    ]);

    const tr = new Transform(doc);
    expect(buildApplyTransaction(tr, schema, entries)).toBe(1);
    expect(tr.doc.textContent).toBe("Keep this");
  });

  it("applies nothing for an empty entry list", () => {
    const doc = threeSpanDoc();
    const tr = new Transform(doc);
    expect(buildApplyTransaction(tr, schema, [])).toBe(0);
    expect(tr.doc.textContent).toBe(doc.textContent);
    expect(tr.steps).toHaveLength(0);
  });

  it("produces one transaction (one undo step) for all replacements", () => {
    const doc = threeSpanDoc();
    const tr = new Transform(doc);
    buildApplyTransaction(tr, schema, planApply(doc, targets));
    // Steps live on a single Transform; the editor dispatches it once.
    expect(tr.steps.length).toBeGreaterThan(0);
    expect(tr.docs[0]).toBe(doc);
  });
});

describe("planApply + buildApplyTransaction round trip", () => {
  it("replaces exactly the marked text and nothing adjacent", () => {
    const doc = docOf(para("prefix ", ["MIDDLE", [ann("m")]], " suffix"));
    const entries: ApplyPlanEntry[] = planApply(doc, [
      { annotationId: "m", suggestedText: "REPLACED", expectedText: "MIDDLE" },
    ]);
    const tr = new Transform(doc);
    buildApplyTransaction(tr, schema, entries);
    expect(tr.doc.textContent).toBe("prefix REPLACED suffix");
  });
});
