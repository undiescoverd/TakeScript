import { Extension } from "@tiptap/core";
import { Editor, Range } from "@tiptap/core";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey, TextSelection } from "@tiptap/pm/state";
import { Fragment, Node as PMNode } from "@tiptap/pm/model";
import { generateBlockId } from "@/lib/utils";
import { getFeatureFlags } from "@/lib/feature-flags";
import { toast } from "sonner";

export interface SelectionContext {
  from: number;
  to: number;
  text: string;
  isEmpty: boolean;
}

export interface SlashCommandItem {
  name: string;
  description: string;
  icon: string;
  command: (props: {
    editor: Editor;
    range: Range;
    selection?: SelectionContext;
  }) => void;
  // Optional: indicates if command requires a selection to work
  requiresSelection?: boolean;
}

/**
 * Wraps selected content in a block-level wrapper node (like demonstration, screenRecording, etc.)
 * This preserves all formatting and block structure within the selection.
 */
function wrapSelectionInBlock(
  editor: Editor,
  selection: SelectionContext,
  blockType: string,
  attrs: Record<string, unknown>
) {
  const { state } = editor;
  const { doc, schema } = state;
  const { from, to } = selection;

  // Resolve positions
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);

  // Find the top-level blocks that contain the selection
  // Walk up from the selection to find blocks at depth 1 (direct children of doc)
  let startDepth = $from.depth;
  while (startDepth > 1) startDepth--;

  let endDepth = $to.depth;
  while (endDepth > 1) endDepth--;

  // Get the positions of the top-level blocks containing the selection
  const startBlockPos = $from.start(1); // Start of the top-level block containing $from
  const endBlockPos = $to.end(1); // End of the top-level block containing $to

  // Collect all top-level blocks in the range
  const blocks: PMNode[] = [];

  doc.nodesBetween(startBlockPos, endBlockPos, (node, pos) => {
    const $pos = doc.resolve(pos);
    // Only collect direct children of the document (depth 0 means position is at doc level)
    if ($pos.depth === 0 && node.isBlock) {
      blocks.push(node);
      return false; // Don't descend into children
    }
    return true;
  });

  // If no blocks found, create a paragraph with the selected text
  if (blocks.length === 0) {
    const selectedText = selection.text;
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, {
        type: blockType,
        attrs,
        content: [{ type: "paragraph", content: selectedText ? [{ type: "text", text: selectedText }] : [] }],
      })
      .run();
    return;
  }

  // Create the wrapper node with the collected blocks as content
  const wrapperType = schema.nodes[blockType];
  if (!wrapperType) {
    console.error(`Block type "${blockType}" not found in schema`);
    return;
  }

  editor.chain().focus().command(({ tr }) => {
    // Calculate the actual end position based on collected blocks
    let actualEndPos = startBlockPos;
    for (const block of blocks) {
      actualEndPos += block.nodeSize;
    }

    // Create the wrapper node with the content
    const wrapperNode = wrapperType.create(attrs, Fragment.from(blocks));

    // Replace the range with the wrapper
    tr.replaceWith(startBlockPos, actualEndPos, wrapperNode);

    return true;
  }).run();
}

export const slashCommandItems: SlashCommandItem[] = [
  // Basic text blocks
  {
    name: "Text",
    description: "Start typing with plain text.",
    icon: "T",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        // Delete slash, then set selection to paragraph
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .setParagraph()
          .run();
      } else {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      }
    },
  },
  {
    name: "Heading 1",
    description: "Headings in the largest font.",
    icon: "H1",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .setNode("heading", { level: 1 })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      }
    },
  },
  {
    name: "Heading 2",
    description: "Headings in the 2nd font size.",
    icon: "H2",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .setNode("heading", { level: 2 })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      }
    },
  },
  {
    name: "Heading 3",
    description: "Headings in the 3rd font size.",
    icon: "H3",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .setNode("heading", { level: 3 })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      }
    },
  },
  {
    name: "Bullet List",
    description: "Create a simple bullet list.",
    icon: "—",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .toggleBulletList()
          .run();
      } else {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      }
    },
  },
  {
    name: "Numbered List",
    description: "Create a numbered list.",
    icon: "1.",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .toggleOrderedList()
          .run();
      } else {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      }
    },
  },
  {
    name: "Quote",
    description: "Add a blockquote for emphasis.",
    icon: "„",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .toggleBlockquote()
          .run();
      } else {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      }
    },
  },
  {
    name: "Code Block",
    description: "Code snippet with formatting.",
    icon: "[]",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setTextSelection({ from: selection.from, to: selection.to })
          .toggleCodeBlock()
          .run();
      } else {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      }
    },
  },
  // Script-specific blocks
  {
    name: "Chapter",
    description: "Add a chapter heading.",
    icon: "Ch",
    command: ({ editor, range, selection }) => {
      if (selection && !selection.isEmpty) {
        // Use selected text as the chapter title
        const selectedText = selection.text.trim();

        // Calculate the range that includes both the "/" and the selected text
        // After Cmd+K, "/" is inserted at the start of selection, so:
        // - range.from is where "/" starts
        // - selection.to is where the selected text ends
        const deleteFrom = Math.min(range.from, selection.from);
        const deleteTo = Math.max(range.to, selection.to);

        // Delete slash command and selected text in one operation, then insert chapter
        editor
          .chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: deleteTo })
          .insertContent({
            type: "chapter",
            attrs: {
              title: selectedText || "New Chapter",
              id: generateBlockId("chapter"),
            },
            content: [{ type: "paragraph" }],
          })
          .run();
      } else {
        // No selection - delete slash and insert new empty chapter (will open in edit mode)
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
            content: [{ type: "paragraph" }],
          })
          .run();
      }
    },
  },
  {
    name: "Screen Recording",
    description: "Add a screen recording section.",
    icon: "Sc",
    command: ({ editor, range, selection }) => {
      // Delete the slash command
      editor.chain().focus().deleteRange(range).run();

      if (selection && !selection.isEmpty) {
        // Wrap selected content in a screen recording block
        wrapSelectionInBlock(editor, selection, "screenRecording", {
          id: generateBlockId("screenRecording"),
        });
      } else {
        // No selection - insert new block with placeholder
        editor
          .chain()
          .focus()
          .insertContent({
            type: "screenRecording",
            attrs: { id: generateBlockId("screenRecording") },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Describe screen recording..." }] }],
          })
          .run();
      }
    },
  },
  {
    name: "Animation",
    description: "Add an animation section.",
    icon: "An",
    command: ({ editor, range, selection }) => {
      // Delete the slash command
      editor.chain().focus().deleteRange(range).run();

      if (selection && !selection.isEmpty) {
        // Wrap selected content in an animation block
        wrapSelectionInBlock(editor, selection, "demonstration", {
          id: generateBlockId("demonstration"),
        });
      } else {
        // No selection - insert new block with placeholder
        editor
          .chain()
          .focus()
          .insertContent({
            type: "demonstration",
            attrs: { id: generateBlockId("demonstration") },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Describe animation..." }] }],
          })
          .run();
      }
    },
  },
  {
    name: "Editor Note",
    description: "Hidden in recording mode.",
    icon: "Ed",
    command: ({ editor, range, selection }) => {
      // Delete the slash command
      editor.chain().focus().deleteRange(range).run();

      if (selection && !selection.isEmpty) {
        // Wrap selected content in an editor note block
        wrapSelectionInBlock(editor, selection, "editorNote", {
          id: generateBlockId("editorNote"),
        });
      } else {
        // No selection - insert new block with placeholder
        editor
          .chain()
          .focus()
          .insertContent({
            type: "editorNote",
            attrs: { id: generateBlockId("editorNote") },
            content: [{ type: "paragraph", content: [{ type: "text", text: "Editor note..." }] }],
          })
          .run();
      }
    },
  },
  {
    name: "Thumbnail Title",
    description: "Add a thumbnail title section.",
    icon: "Th",
    command: ({ editor, range, selection }) => {
      // Delete the slash command
      editor.chain().focus().deleteRange(range).run();

      if (selection && !selection.isEmpty) {
        // Wrap selected content in a thumbnail title block
        wrapSelectionInBlock(editor, selection, "thumbnailTitle", {
          title: "Thumbnail Title",
          id: generateBlockId("thumbnailTitle"),
        });
      } else {
        // No selection - insert new empty thumbnail title block
        editor
          .chain()
          .focus()
          .insertContent({
            type: "thumbnailTitle",
            attrs: {
              title: "Thumbnail Title",
              id: generateBlockId("thumbnailTitle"),
            },
            content: [{ type: "paragraph" }],
          })
          .run();
      }
    },
  },
  // Speaker commands
  {
    name: "Speaker",
    description: "Assign first speaker to current paragraph.",
    icon: "Sp",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();

      // Get speakers from the store
      // We need to import useSpeakerStore dynamically or access it via a different method
      // For now, we'll use a simple approach: try to get the first speaker via a custom command

      // Check if there are any speakers available
      const { state } = editor;
      const { $from } = state.selection;

      // Find the paragraph boundaries
      const paragraphStart = $from.start();
      const paragraphEnd = $from.end();

      // Try to apply first speaker mark to the current paragraph
      // The editor extension should have access to getSpeakers
      const extension = editor.extensionManager.extensions.find(
        (ext) => ext.name === "speaker"
      );

      if (extension && typeof extension.options.getSpeakers === "function") {
        const speakers = extension.options.getSpeakers();

        if (speakers.length === 0) {
          // No speakers available - show error
          toast.error("No speakers available. Add a speaker first.");
          return;
        }

        // Apply the first speaker to the current paragraph
        const firstSpeaker = speakers[0];
        editor
          .chain()
          .focus()
          .setTextSelection({ from: paragraphStart, to: paragraphEnd })
          .setSpeaker({
            speakerId: firstSpeaker.id,
            cameraMode: firstSpeaker.defaultVisibility || null,
          })
          .run();
      }
    },
  },
  {
    name: "Remove Speaker",
    description: "Remove speaker from selection.",
    icon: "Rs",
    command: ({ editor, range, selection }) => {
      editor.chain().focus().deleteRange(range).run();
      if (selection && !selection.isEmpty) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: selection.from, to: selection.to })
          .unsetSpeaker()
          .run();
      } else {
        // Remove from current paragraph if no selection
        const { $from } = editor.state.selection;
        const paragraphStart = $from.start();
        const paragraphEnd = $from.end();
        editor
          .chain()
          .focus()
          .setTextSelection({ from: paragraphStart, to: paragraphEnd })
          .unsetSpeaker()
          .run();
      }
    },
  },
];

// AI Commands (dynamically added based on feature flags)
export function getAICommands(): SlashCommandItem[] {
  const flags = getFeatureFlags();
  const aiCommands: SlashCommandItem[] = [];

  if (flags.aiGenerationEnabled) {
    aiCommands.push({
      name: "AI Generate",
      description: "Generate content with AI.",
      icon: "✨",
      command: ({ editor, range, selection }) => {
        editor.chain().focus().deleteRange(range).run();
        // Dispatch custom event to open generation dialog
        window.dispatchEvent(
          new CustomEvent("ai:generate", {
            detail: {
              editor,
              range,
              selection: selection || null,
            },
          })
        );
      },
    });

    aiCommands.push({
      name: "AI Expand",
      description: "Expand selected text with AI.",
      icon: "🔍",
      requiresSelection: true,
      command: ({ editor, range, selection }) => {
        const selectedText = selection?.text || "";
        editor.chain().focus().deleteRange(range).run();
        window.dispatchEvent(
          new CustomEvent("ai:expand", {
            detail: {
              editor,
              range,
              selectedText,
              selection: selection || null,
            },
          })
        );
      },
    });

    aiCommands.push({
      name: "AI Rephrase",
      description: "Rephrase text for clarity.",
      icon: "✏️",
      requiresSelection: true,
      command: ({ editor, range, selection }) => {
        const selectedText = selection?.text || "";
        editor.chain().focus().deleteRange(range).run();
        window.dispatchEvent(
          new CustomEvent("ai:rephrase", {
            detail: {
              editor,
              range,
              selectedText,
              selection: selection || null,
            },
          })
        );
      },
    });

    aiCommands.push({
      name: "AI Summarize",
      description: "Summarize text concisely.",
      icon: "📝",
      requiresSelection: true,
      command: ({ editor, range, selection }) => {
        const selectedText = selection?.text || "";
        editor.chain().focus().deleteRange(range).run();
        window.dispatchEvent(
          new CustomEvent("ai:summarize", {
            detail: {
              editor,
              range,
              selectedText,
              selection: selection || null,
            },
          })
        );
      },
    });
  }

  return aiCommands;
}

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

// Store selection context when slash command is triggered
let capturedSelection: SelectionContext | undefined;

// Default suggestion options - these will be merged with user-provided options
const defaultSuggestionOptions = {
  char: "/",
  startOfLine: false,
  pluginKey: SlashCommandsPluginKey,

  // Capture selection state when suggestion is triggered
  allow: ({ state, range }: { state: any; range: Range }) => {
    const { selection } = state;
    const { from, to } = selection;

    // Capture the selection BEFORE the "/" character was typed
    // The "/" character position is at range.from
    // If there was a selection before typing "/", we need to capture it
    // Check if there's a meaningful selection (not just cursor position)
    const hasSelection = from !== to;

    if (hasSelection) {
      // Store selection for use in commands
      capturedSelection = {
        from: from,
        to: to,
        text: state.doc.textBetween(from, to),
        isEmpty: false,
      };
    } else {
      capturedSelection = undefined;
    }

    return true; // Allow the suggestion to proceed
  },

  command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandItem }) => {
    // Pass captured selection to command
    props.command({ editor, range, selection: capturedSelection });
    // Clear captured selection after use
    capturedSelection = undefined;
  },

  items: ({ query }: { query: string }) => {
    // Combine base commands with AI commands
    const allItems = [...slashCommandItems, ...getAICommands()];

    // Filter out commands that require selection if no selection exists
    const filteredItems = allItems.filter(item => {
      if (item.requiresSelection && (!capturedSelection || capturedSelection.isEmpty)) {
        return false;
      }
      return true;
    });

    // Score and filter items
    const scoredItems = filteredItems
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

  addKeyboardShortcuts() {
    return {
      // Mod+k opens command menu (Cmd+K on Mac, Ctrl+K on Windows/Linux)
      "Mod-k": () => {
        const { state } = this.editor;
        const { selection } = state;
        const { from, to } = selection;

        // Capture current selection (if any)
        const hasSelection = from !== to;

        if (hasSelection) {
          // Store the original selection
          capturedSelection = {
            from: from + 1, // Adjust for "/" that will be inserted before selection
            to: to + 1,
            text: state.doc.textBetween(from, to),
            isEmpty: false,
          };

          // Insert "/" at the START of selection, keeping selection intact
          this.editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.insertText("/", from, from);
              return true;
            })
            .run();
        } else {
          capturedSelection = undefined;

          // No selection, just insert "/" normally
          this.editor
            .chain()
            .focus()
            .insertContent("/")
            .run();
        }

        return true; // Prevent default Cmd+K behavior
      },
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
