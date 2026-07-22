import { describe, it, expect } from "vitest";
import { Schema, Node as PMNode } from "@tiptap/pm/model";
import { findAnnotationRange, findAnnotationRanges } from "./find-annotation-range";

// Same minimal schema as resolve-text-position.test.ts, plus the two marks the
// range walk actually has to reason about: `annotation` (what we search for)
// and `strong` (which splits a text node WITHOUT creating a positional gap —
// the regression this module exists to prevent).
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
const strong = () => schema.marks.strong.create();

/** Build a paragraph from [text, marks] pairs. */
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

describe("findAnnotationRange", () => {
  it("returns a single run for one contiguous marked text node", () => {
    const doc = docOf(para("Hello ", ["brave world", [ann("a1")]], "!"));
    const found = findAnnotationRange(doc, "a1");

    expect(found.status).toBe("single");
    if (found.status !== "single") return;
    expect(doc.textBetween(found.from, found.to)).toBe("brave world");
    expect(found.text).toBe("brave world");
  });

  it("merges adjacent text nodes split by an inner mark into ONE run", () => {
    // "brave" + bold "new" + " world", all carrying the same annotation.
    // ProseMirror stores this as three text nodes with no gap between them.
    // A naive walk reports three runs and refuses to apply; that is the bug.
    const doc = docOf(
      para(
        "Hello ",
        ["brave ", [ann("a1")]],
        ["new", [ann("a1"), strong()]],
        [" world", [ann("a1")]],
        "!"
      )
    );
    const found = findAnnotationRange(doc, "a1");

    expect(found.status).toBe("single");
    if (found.status !== "single") return;
    expect(found.text).toBe("brave new world");
  });

  it("reports split when the same id appears in two disjoint places", () => {
    const doc = docOf(
      para("Start ", ["one", [ann("a1")]], " middle ", ["two", [ann("a1")]], " end")
    );
    const found = findAnnotationRange(doc, "a1");

    expect(found.status).toBe("split");
    if (found.status !== "split") return;
    expect(found.runs).toHaveLength(2);
    expect(doc.textBetween(found.runs[0].from, found.runs[0].to)).toBe("one");
    expect(doc.textBetween(found.runs[1].from, found.runs[1].to)).toBe("two");
  });

  it("reports split across separate paragraphs (a block boundary is a gap)", () => {
    const doc = docOf(
      para(["first", [ann("a1")]]),
      para(["second", [ann("a1")]])
    );
    expect(findAnnotationRange(doc, "a1").status).toBe("split");
  });

  it("returns missing when the id is absent", () => {
    const doc = docOf(para("Hello ", ["world", [ann("a1")]]));
    expect(findAnnotationRange(doc, "nope").status).toBe("missing");
  });

  it("ignores annotations belonging to other ids", () => {
    const doc = docOf(
      para(["alpha", [ann("a1")]], " ", ["beta", [ann("a2")]])
    );
    const found = findAnnotationRange(doc, "a2");
    expect(found.status).toBe("single");
    if (found.status !== "single") return;
    expect(found.text).toBe("beta");
  });

  // Regression against the inline walk this replaces (AnnotationsPanel.tsx:118-150),
  // which set foundFrom to the FIRST match and foundTo to the LAST match anywhere
  // in the doc — selecting everything in between, including unrelated text.
  it("does not return the spanning range for a split annotation", () => {
    const doc = docOf(
      para(["one", [ann("a1")]], " UNRELATED TEXT ", ["two", [ann("a1")]])
    );
    const found = findAnnotationRange(doc, "a1");

    expect(found.status).toBe("split");
    if (found.status !== "split") return;
    // The old code would have produced from=runs[0].from, to=runs[1].to —
    // a range whose text includes "UNRELATED TEXT".
    const spanning = doc.textBetween(found.runs[0].from, found.runs[1].to);
    expect(spanning).toContain("UNRELATED TEXT");
    // ...and that range is exactly what we now refuse to hand back as usable.
    expect(found).not.toHaveProperty("from");
  });
});

describe("findAnnotationRanges", () => {
  it("resolves many ids in a single walk", () => {
    const doc = docOf(
      para(["alpha", [ann("a1")]], " and ", ["beta", [ann("a2")]]),
      para(["gamma", [ann("a3")]], " x ", ["gamma2", [ann("a3")]])
    );

    const map = findAnnotationRanges(doc, ["a1", "a2", "a3", "missing-id"]);

    expect(map.get("a1")?.status).toBe("single");
    expect(map.get("a2")?.status).toBe("single");
    expect(map.get("a3")?.status).toBe("split");
    expect(map.get("missing-id")?.status).toBe("missing");
  });

  it("agrees with findAnnotationRange for every id", () => {
    const doc = docOf(
      para("x ", ["one", [ann("a1")]], " y ", ["two", [ann("a1")]]),
      para(["solo", [ann("a2")]])
    );
    const ids = ["a1", "a2", "ghost"];
    const map = findAnnotationRanges(doc, ids);
    for (const id of ids) {
      expect(map.get(id)).toEqual(findAnnotationRange(doc, id));
    }
  });

  it("returns an entry for every requested id, even unmarked ones", () => {
    const doc = docOf(para("nothing marked here"));
    const map = findAnnotationRanges(doc, ["a", "b"]);
    expect(map.size).toBe(2);
    expect(map.get("a")?.status).toBe("missing");
  });
});
