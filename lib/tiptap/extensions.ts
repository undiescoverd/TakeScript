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
        // Insert a new paragraph after the chapter block and move cursor there
        const { $from } = editor.state.selection;
        const endPos = $from.end($from.depth);

        return editor
          .chain()
          .insertContentAt(endPos + 1, { type: "paragraph" })
          .focus()
          .run();
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
