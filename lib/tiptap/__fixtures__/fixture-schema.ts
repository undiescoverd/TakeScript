/**
 * A ProseMirror schema permissive enough to rehydrate real editor documents
 * harvested from the app, without importing Tiptap's React extension stack
 * into a node-based test run.
 *
 * It only has to be structurally faithful: `buildDocIndex` cares about which
 * nodes are text and which are blocks, and nothing else. Attributes are
 * declared loosely (every custom node takes an open bag) so a harvested doc
 * with attributes this file has not anticipated still parses instead of
 * throwing and quietly reducing the measured sample.
 */

import { Schema } from "@tiptap/pm/model";

const blockAttrs = {
  id: { default: null },
  title: { default: null },
  duration: { default: null },
  description: { default: null },
  level: { default: 1 },
};

const container = (tag: string) => ({
  group: "block",
  content: "block+",
  defining: true,
  attrs: blockAttrs,
  toDOM: () => [tag, 0] as [string, number],
});

export const fixtureSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: blockAttrs,
      toDOM: () => ["p", 0],
    },
    heading: {
      group: "block",
      content: "inline*",
      attrs: blockAttrs,
      toDOM: () => ["h1", 0],
    },
    blockquote: container("blockquote"),
    codeBlock: {
      group: "block",
      content: "text*",
      marks: "",
      code: true,
      attrs: blockAttrs,
      toDOM: () => ["pre", 0] as [string, number],
    },
    bulletList: container("ul"),
    orderedList: container("ol"),
    listItem: container("li"),
    taskList: container("ul"),
    taskItem: container("li"),
    // TakeScript's custom blocks (lib/tiptap/extensions.ts).
    chapter: container("section"),
    screenRecording: container("section"),
    demonstration: container("section"),
    thumbnailTitle: container("section"),
    editorNote: container("aside"),
    horizontalRule: { group: "block", toDOM: () => ["hr"] as [string] },
    hardBreak: { group: "inline", inline: true, toDOM: () => ["br"] as [string] },
    text: { group: "inline" },
  },
  marks: {
    bold: { toDOM: () => ["strong", 0] },
    italic: { toDOM: () => ["em", 0] },
    underline: { toDOM: () => ["u", 0] },
    strike: { toDOM: () => ["s", 0] },
    code: { toDOM: () => ["code", 0] },
    highlight: { attrs: { color: { default: null } }, toDOM: () => ["mark", 0] },
    link: { attrs: { href: { default: null } }, toDOM: () => ["a", 0] },
    annotation: {
      attrs: { annotationId: { default: null }, color: { default: "ai" } },
      toDOM: () => ["span", 0],
    },
    speaker: {
      attrs: { speakerId: { default: null }, faceVisible: { default: true } },
      toDOM: () => ["span", 0],
    },
  },
});
