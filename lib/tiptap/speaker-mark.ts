import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

// Camera mode types
export type CameraMode = "full" | "corner" | "voiceover";

// Display labels for camera modes (used in editor UI)
export const cameraModeLabels: Record<CameraMode, string> = {
  full: "Full Screen",
  corner: "Corner",
  voiceover: "Voiceover",
};

// Speaker interface
export interface Speaker {
  id: string;
  name: string;
  color: string;
  defaultVisibility?: CameraMode;
}

export interface SpeakerMarkOptions {
  HTMLAttributes: Record<string, unknown>;
  getSpeakers: () => Speaker[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    speakerMark: {
      /**
       * Set a speaker mark on the selection
       */
      setSpeaker: (attributes: {
        speakerId: string;
        cameraMode?: CameraMode;
      }) => ReturnType;
      /**
       * Toggle a speaker mark
       */
      toggleSpeaker: (attributes: {
        speakerId: string;
        cameraMode?: CameraMode;
      }) => ReturnType;
      /**
       * Remove speaker mark from selection
       */
      unsetSpeaker: () => ReturnType;
      /**
       * Remove all instances of a specific speaker (for deletion cascade)
       */
      removeSpeaker: (speakerId: string) => ReturnType;
    };
  }
}

// Plugin key for the decoration plugin
const SpeakerDecorationPluginKey = new PluginKey("speakerDecoration");

/**
 * Find the first speaker mark in a paragraph node
 */
function findSpeakerInParagraph(
  node: ProseMirrorNode
): { speakerId: string; cameraMode: CameraMode } | null {
  let result: { speakerId: string; cameraMode: CameraMode } | null = null;

  node.descendants((child) => {
    if (result) return false; // Stop if we found one

    if (child.isText) {
      const speakerMark = child.marks.find((m) => m.type.name === "speaker");
      if (speakerMark) {
        result = {
          speakerId: speakerMark.attrs.speakerId,
          cameraMode: speakerMark.attrs.cameraMode || "full",
        };
        return false;
      }
    }
    return true;
  });

  return result;
}

/**
 * Build decorations for paragraphs with speaker marks
 */
function buildDecorations(
  doc: ProseMirrorNode,
  getSpeakers: () => Speaker[]
): DecorationSet {
  const decorations: Decoration[] = [];
  const speakers = getSpeakers();
  let prevSpeakerId: string | null = null;

  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph") {
      const speakerInfo = findSpeakerInParagraph(node);

      if (speakerInfo) {
        const { speakerId, cameraMode } = speakerInfo;
        const speaker = speakers.find((s) => s.id === speakerId);
        const isFirstOfRun = speakerId !== prevSpeakerId;

        const attrs: Record<string, string> = {
          "data-paragraph-speaker": speakerId,
          "data-speaker-name": speaker?.name.toUpperCase() || "UNKNOWN",
          "data-camera-mode": cameraModeLabels[cameraMode],
          style: `--speaker-color: ${speaker?.color || "#3b82f6"}`,
        };

        if (isFirstOfRun) {
          attrs["data-show-label"] = "true";
        }

        decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
        prevSpeakerId = speakerId;
      } else {
        // Reset tracking when we hit a non-speaker paragraph
        prevSpeakerId = null;
      }
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Create the decoration plugin for speaker marks
 */
function createSpeakerDecorationPlugin(getSpeakers: () => Speaker[]) {
  return new Plugin({
    key: SpeakerDecorationPluginKey,
    state: {
      init(_, { doc }) {
        return buildDecorations(doc, getSpeakers);
      },
      apply(tr, oldSet) {
        if (tr.docChanged) {
          return buildDecorations(tr.doc, getSpeakers);
        }
        return oldSet;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

export const SpeakerMark = Mark.create<SpeakerMarkOptions>({
  name: "speaker",

  addOptions() {
    return {
      HTMLAttributes: {},
      getSpeakers: () => [],
    };
  },

  addAttributes() {
    return {
      speakerId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-speaker-id"),
        renderHTML: (attributes) => {
          if (!attributes.speakerId) {
            return {};
          }
          return {
            "data-speaker-id": attributes.speakerId,
          };
        },
      },
      cameraMode: {
        default: "full" as CameraMode,
        parseHTML: (element) =>
          (element.getAttribute("data-camera-mode") as CameraMode) || "full",
        renderHTML: (attributes) => {
          return {
            "data-camera-mode": attributes.cameraMode,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-speaker-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "speaker-mark",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSpeaker:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, {
            speakerId: attributes.speakerId,
            cameraMode: attributes.cameraMode || "full",
          });
        },

      toggleSpeaker:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, {
            speakerId: attributes.speakerId,
            cameraMode: attributes.cameraMode || "full",
          });
        },

      unsetSpeaker:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },

      removeSpeaker:
        (speakerId) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return true;

          const { doc } = state;
          const markType = state.schema.marks[this.name];

          // Find and remove all instances of this speaker
          doc.descendants((node, pos) => {
            if (!node.isText) return;

            const marks = node.marks.filter(
              (mark) =>
                mark.type === markType && mark.attrs.speakerId === speakerId
            );

            marks.forEach((mark) => {
              tr.removeMark(pos, pos + node.nodeSize, mark);
            });
          });

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;

        // Check if current position has speaker mark
        const speakerMark = $from.marks().find((m) => m.type.name === "speaker");

        if (speakerMark) {
          // Split block and apply same speaker mark to new paragraph
          return editor
            .chain()
            .splitBlock()
            .setMark("speaker", {
              speakerId: speakerMark.attrs.speakerId,
              cameraMode: speakerMark.attrs.cameraMode,
            })
            .run();
        }

        return false; // Let default Enter behavior happen
      },
    };
  },

  addProseMirrorPlugins() {
    return [createSpeakerDecorationPlugin(this.options.getSpeakers)];
  },
});

// Default speaker colors
export const defaultSpeakerColors = [
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];
