import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SpeakerMarkAttributes {
  speakerId: string;
  faceVisible?: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    speakerMark: {
      /**
       * Set speaker attribution
       */
      setSpeaker: (speakerId: string, faceVisible?: boolean) => ReturnType;
      /**
       * Unset speaker attribution
       */
      unsetSpeaker: () => ReturnType;
      /**
       * Toggle speaker attribution
       */
      toggleSpeaker: (speakerId: string, faceVisible?: boolean) => ReturnType;
    };
  }
}

export const SpeakerMark = Mark.create({
  name: "speaker",

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
      faceVisible: {
        default: true,
        parseHTML: (element) => {
          const value = element.getAttribute("data-face-visible");
          return value === "false" ? false : true;
        },
        renderHTML: (attributes) => {
          return {
            "data-face-visible": attributes.faceVisible !== false ? "true" : "false",
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
        class: "speaker-text",
        "data-speaker-id": HTMLAttributes.speakerId,
        "data-face-visible": HTMLAttributes.faceVisible !== false ? "true" : "false",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSpeaker:
        (speakerId: string, faceVisible: boolean = true) =>
        ({ commands }) => {
          return commands.setMark(this.name, { speakerId, faceVisible });
        },
      unsetSpeaker:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      toggleSpeaker:
        (speakerId: string, faceVisible: boolean = true) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { speakerId, faceVisible });
        },
    };
  },

  addProseMirrorPlugins() {
    // Helper function for creating pill decorations
    const createPillDecorations = (doc: any) => {
      const decorations: Decoration[] = [];
      let lastSpeakerId: string | null = null;
      let lastFaceVisible: boolean = true;
      let lastParagraphHadSpeaker = false;

      const sectionBreakNodes = [
        "chapter",
        "heading",
        "screenRecording",
        "demonstration",
        "editorNote",
        "horizontalRule",
        "blockquote",
      ];

      doc.descendants((node: any, pos: number) => {
        if (sectionBreakNodes.includes(node.type.name)) {
          lastSpeakerId = null;
          lastFaceVisible = true;
          lastParagraphHadSpeaker = false;
          return true;
        }

        if (node.type.name === "paragraph") {
          let currentSpeakerId: string | null = null;
          let faceVisible = true;

          node.descendants((child: any) => {
            const speakerMark = child.marks.find(
              (m: any) => m.type.name === "speaker"
            );
            if (speakerMark?.attrs.speakerId) {
              currentSpeakerId = speakerMark.attrs.speakerId;
              faceVisible = speakerMark.attrs.faceVisible !== false;
            }
          });

          if (currentSpeakerId) {
            // Create new pill if: speaker changed OR visibility changed OR first in section
            if (currentSpeakerId !== lastSpeakerId ||
                faceVisible !== lastFaceVisible ||
                !lastParagraphHadSpeaker) {
              const pill = document.createElement("span");
              pill.className = "speaker-pill-widget";
              pill.setAttribute("data-speaker-id", currentSpeakerId);
              pill.setAttribute("data-face-visible", String(faceVisible));
              pill.setAttribute("data-position", String(pos + 1));
              pill.contentEditable = "false";

              decorations.push(
                Decoration.widget(pos + 1, pill, {
                  side: -1,
                  ignoreSelection: true,
                })
              );

              lastSpeakerId = currentSpeakerId;
              lastFaceVisible = faceVisible; // Track visibility state
            }
            lastParagraphHadSpeaker = true;
          } else {
            lastParagraphHadSpeaker = false;
            lastSpeakerId = null;
            lastFaceVisible = true;
          }
        }
      });

      return DecorationSet.create(doc, decorations);
    };

    // CONSOLIDATED PLUGIN: Creates pill widgets AND adds data-speaker-id to paragraphs
    return [
      new Plugin({
        key: new PluginKey("speakerPillDecorations"),
        state: {
          init(_, state) {
            return createPillDecorations(state.doc);
          },
          apply(tr, oldSet) {
            // PERFORMANCE FIX: Only recalculate if document changed
            if (!tr.docChanged) {
              return oldSet.map(tr.mapping, tr.doc);
            }
            return createPillDecorations(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
