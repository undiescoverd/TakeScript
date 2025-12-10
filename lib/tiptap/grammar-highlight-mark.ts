import { Mark, mergeAttributes } from "@tiptap/core";

export interface GrammarHighlightMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    grammarHighlight: {
      /**
       * Set a grammar highlight mark
       */
      setGrammarHighlight: (attributes: {
        issueId: string;
        issueType: string;
      }) => ReturnType;
      /**
       * Clear grammar highlight mark
       */
      clearGrammarHighlight: () => ReturnType;
    };
  }
}

export const GrammarHighlightMark = Mark.create<GrammarHighlightMarkOptions>({
  name: "grammarHighlight",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      issueId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-issue-id"),
        renderHTML: (attributes) => {
          if (!attributes.issueId) {
            return {};
          }
          return {
            "data-issue-id": attributes.issueId,
          };
        },
      },
      issueType: {
        default: "grammar",
        parseHTML: (element) =>
          element.getAttribute("data-issue-type") || "grammar",
        renderHTML: (attributes) => {
          return {
            "data-issue-type": attributes.issueType,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-issue-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const issueType = HTMLAttributes["data-issue-type"] || "grammar";
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `grammar-highlight grammar-highlight-${issueType}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setGrammarHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      clearGrammarHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
