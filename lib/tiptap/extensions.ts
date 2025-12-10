import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ChapterNodeView } from "./ChapterNodeView";
import { ScreenRecordingNodeView } from "./ScreenRecordingNodeView";
import { DemonstrationNodeView } from "./DemonstrationNodeView";
import { ThumbnailTitleNodeView } from "./ThumbnailTitleNodeView";

// Re-export SpeakerMark for use in components
export { SpeakerMark } from "./speaker-mark";
export type { Speaker, CameraMode } from "./speaker-mark";
export { cameraModeLabels, defaultSpeakerColors } from "./speaker-mark";

// Chapter Block Extension
// Supports wrapping block content (lists, paragraphs, etc.) while preserving formatting
export const ChapterBlock = Node.create({
  name: "chapter",
  group: "block",
  content: "block+",
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
});

// Screen Recording Block Extension
// Supports wrapping block content (lists, paragraphs, etc.) while preserving formatting
export const ScreenRecordingBlock = Node.create({
  name: "screenRecording",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
      description: {
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

// Demonstration/Animation Block Extension
// Supports wrapping block content (lists, paragraphs, etc.) while preserving formatting
export const DemonstrationBlock = Node.create({
  name: "demonstration",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
      description: {
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

// Thumbnail Title Block Extension
// Supports wrapping block content with an editable title for video thumbnails
export const ThumbnailTitleBlock = Node.create({
  name: "thumbnailTitle",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      title: {
        default: "Thumbnail Title",
      },
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="thumbnailTitle"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "thumbnailTitle",
        "data-id": HTMLAttributes.id,
        class: "thumbnail-title-block",
      }),
      [
        "span",
        { class: "thumbnail-title-label" },
        HTMLAttributes.title || "Thumbnail Title",
      ],
      ["div", { class: "thumbnail-title-content" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ThumbnailTitleNodeView);
  },
});

// Export all extensions
export const customExtensions = [
  ChapterBlock,
  ScreenRecordingBlock,
  DemonstrationBlock,
  ThumbnailTitleBlock,
];
