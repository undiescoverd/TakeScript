import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ChapterNodeView } from "./ChapterNodeView";
import { ScreenRecordingNodeView } from "./ScreenRecordingNodeView";
import { DemonstrationNodeView } from "./DemonstrationNodeView";
import { EditorNoteNodeView } from "./EditorNoteNodeView";

// Chapter Block Extension
export const ChapterBlock = Node.create({
  name: "chapter",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      title: {
        default: "Untitled Chapter",
      },
      duration: {
        default: null,
      },
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="chapter"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "chapter",
        "data-id": HTMLAttributes.id,
        class: "chapter-block",
      }),
      [
        "span",
        { class: "chapter-title" },
        HTMLAttributes.title || "Untitled Chapter",
      ],
      HTMLAttributes.duration
        ? ["span", { class: "chapter-duration" }, `(${HTMLAttributes.duration})`]
        : "",
      ["div", { class: "chapter-content" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChapterNodeView);
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;

        // Only handle when selection is collapsed (no text selected)
        if (!empty) {
          return false;
        }

        // Check if we're actually inside a chapter node
        const chapterNode = $from.node($from.depth - 1);
        if (chapterNode?.type.name !== "chapter") {
          return false;
        }

        // Check if cursor is at the end of the chapter content
        const isAtEnd = $from.parentOffset === $from.parent.content.size;

        if (isAtEnd) {
          // Find the position after the chapter block and insert paragraph there
          const chapterPos = $from.before($from.depth - 1);
          const chapterEndPos = chapterPos + chapterNode.nodeSize;

          return editor
            .chain()
            .insertContentAt(chapterEndPos, { type: "paragraph" })
            .focus()
            .run();
        }

        // Allow normal Enter behavior (soft break or default) inside chapter content
        return false;
      },
    };
  },
});

// Screen Recording Block Extension
export const ScreenRecordingBlock = Node.create({
  name: "screenRecording",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="screenRecording"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "screenRecording",
        class: "screen-recording-block",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScreenRecordingNodeView);
  },
});

// Demonstration Block Extension
export const DemonstrationBlock = Node.create({
  name: "demonstration",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="demonstration"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "demonstration",
        class: "demonstration-block",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DemonstrationNodeView);
  },
});

// Editor Note Block Extension
export const EditorNoteBlock = Node.create({
  name: "editorNote",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="editorNote"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "editorNote",
        class: "editor-note-block",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorNoteNodeView);
  },
});

// Export all extensions
export const customExtensions = [
  ChapterBlock,
  ScreenRecordingBlock,
  DemonstrationBlock,
  EditorNoteBlock,
];
