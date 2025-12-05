import { Extension } from "@tiptap/core";
import { Editor, Range } from "@tiptap/core";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { generateBlockId } from "@/lib/utils";

export interface SlashCommandItem {
  name: string;
  description: string;
  icon: string;
  command: (props: { editor: Editor; range: Range }) => void;
}

export const slashCommandItems: SlashCommandItem[] = [
  // Basic text blocks
  {
    name: "Text",
    description: "Start typing with plain text.",
    icon: "T",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setParagraph()
        .run();
    },
  },
  {
    name: "Heading 1",
    description: "Headings in the largest font.",
    icon: "H1",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run();
    },
  },
  {
    name: "Heading 2",
    description: "Headings in the 2nd font size.",
    icon: "H2",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run();
    },
  },
  {
    name: "Heading 3",
    description: "Headings in the 3rd font size.",
    icon: "H3",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run();
    },
  },
  {
    name: "Bullet List",
    description: "Create a simple bullet list.",
    icon: "—",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBulletList()
        .run();
    },
  },
  {
    name: "Numbered List",
    description: "Create a numbered list.",
    icon: "1.",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleOrderedList()
        .run();
    },
  },
  {
    name: "Quote",
    description: "Add a blockquote for emphasis.",
    icon: "„",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBlockquote()
        .run();
    },
  },
  {
    name: "Code Block",
    description: "Code snippet with formatting.",
    icon: "[]",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCodeBlock()
        .run();
    },
  },
  // Script-specific blocks
  {
    name: "Chapter",
    description: "Add a chapter heading.",
    icon: "Ch",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "chapter",
          attrs: {
            title: "New Chapter",
            id: generateBlockId("chapter"),
          },
        })
        .run();
    },
  },
  {
    name: "Screen Recording",
    description: "Add a screen recording section.",
    icon: "Sc",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "screenRecording",
          attrs: { id: generateBlockId("screenRecording") },
          content: [{ type: "text", text: "Describe screen recording..." }],
        })
        .run();
    },
  },
  {
    name: "Demonstration",
    description: "Add a demonstration section.",
    icon: "Dm",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "demonstration",
          attrs: { id: generateBlockId("demonstration") },
          content: [{ type: "text", text: "Describe demonstration..." }],
        })
        .run();
    },
  },
  {
    name: "Editor Note",
    description: "Hidden in recording mode.",
    icon: "Ed",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "editorNote",
          attrs: { id: generateBlockId("editorNote") },
          content: [{ type: "text", text: "Editor note..." }],
        })
        .run();
    },
  },
];

export const SlashCommandsPluginKey = new PluginKey("slash-commands");

/**
 * Smart matching function that scores items based on how well they match the query
 * Handles: exact matches, icon matches, abbreviations, partial matches
 */
function smartMatch(
  item: SlashCommandItem,
  query: string
): { matches: boolean; score: number } {
  if (!query) {
    return { matches: true, score: 0 };
  }

  const lowerQuery = query.toLowerCase().trim();
  const lowerName = item.name.toLowerCase();
  const lowerDescription = item.description.toLowerCase();
  const lowerIcon = item.icon.toLowerCase();

  // Exact name match (highest priority)
  if (lowerName === lowerQuery) {
    return { matches: true, score: 100 };
  }

  // Icon match (e.g., "h1" matches icon "H1", "h2" matches "H2")
  if (lowerIcon === lowerQuery) {
    return { matches: true, score: 95 };
  }

  // Abbreviation match - first letters of each word
  // "h1" → "Heading 1", "sr" → "Screen Recording", "bl" → "Bullet List"
  const words = lowerName.split(/\s+/);
  const abbreviation = words.map((w) => w[0]).join("");
  if (abbreviation === lowerQuery) {
    return { matches: true, score: 90 };
  }

  // Abbreviation with numbers preserved
  // "h1" → "h" + "1" from "Heading 1"
  const abbreviationWithNumbers = words
    .map((w) => {
      // Extract first letter and any numbers
      const match = w.match(/^([a-z])|(\d+)/g);
      return match ? match.join("") : "";
    })
    .join("");
  if (abbreviationWithNumbers === lowerQuery) {
    return { matches: true, score: 90 };
  }

  // Starts with query
  if (lowerName.startsWith(lowerQuery)) {
    return { matches: true, score: 80 };
  }

  // Word starts with query (e.g., "head" matches "Heading 1")
  if (words.some((word) => word.startsWith(lowerQuery))) {
    return { matches: true, score: 70 };
  }

  // Contains in name
  if (lowerName.includes(lowerQuery)) {
    return { matches: true, score: 60 };
  }

  // Contains in description
  if (lowerDescription.includes(lowerQuery)) {
    return { matches: true, score: 40 };
  }

  // Fuzzy match - all characters present in order
  let nameIndex = 0;
  for (const char of lowerQuery) {
    nameIndex = lowerName.indexOf(char, nameIndex);
    if (nameIndex === -1) {
      return { matches: false, score: 0 };
    }
    nameIndex++;
  }
  return { matches: true, score: 30 };
}

export interface SlashCommandsOptions {
  suggestion: Partial<Omit<SuggestionOptions<SlashCommandItem>, "editor">>;
}

// Default suggestion options - these will be merged with user-provided options
const defaultSuggestionOptions = {
  char: "/",
  startOfLine: false,
  pluginKey: SlashCommandsPluginKey,
  command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
    props.command({ editor, range });
  },
  items: ({ query }: { query: string }) => {
    // Score and filter items
    const scoredItems = slashCommandItems
      .map((item) => ({
        item,
        ...smartMatch(item, query),
      }))
      .filter((scored) => scored.matches)
      .sort((a, b) => b.score - a.score);

    return scoredItems.map((scored) => scored.item);
  },
};

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {},
    };
  },

  addProseMirrorPlugins() {
    // Merge default options with user-provided options
    const suggestionOptions = {
      ...defaultSuggestionOptions,
      ...this.options.suggestion,
    };

    return [
      Suggestion({
        editor: this.editor,
        ...suggestionOptions,
      }),
    ];
  },
});
