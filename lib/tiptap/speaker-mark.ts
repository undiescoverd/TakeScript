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

// Speaker data interface - matches the store
export interface SpeakerData {
  id: string;
  name: string;
  color: string;
  faceVisible: boolean;
}

// Plugin key for speaker decorations - exported for external access
export const speakerDecorationsKey = new PluginKey<{
  decorations: DecorationSet;
  speakers: SpeakerData[];
}>("speakerDecorations");

// Speaker label click callback (for edit button)
type SpeakerLabelClickCallback = (speakerId: string, position: number, faceVisible: boolean) => void;
let speakerLabelClickCallback: SpeakerLabelClickCallback | null = null;

export function onSpeakerLabelClick(callback: SpeakerLabelClickCallback | null) {
  speakerLabelClickCallback = callback;
}

/**
 * Update the speakers in the editor state.
 * This triggers decoration refresh with the new speaker data.
 */
export function updateSpeakersInEditor(
  editor: { view: { dispatch: (tr: any) => void; state: any } },
  speakers: SpeakerData[]
) {
  const { tr } = editor.view.state;
  editor.view.dispatch(tr.setMeta(speakerDecorationsKey, { speakers }));
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
        "data-speaker-id": HTMLAttributes.speakerId || HTMLAttributes["data-speaker-id"],
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
    const sectionBreakNodes = [
      "chapter",
      "heading",
      "screenRecording",
      "demonstration",
      "editorNote",
      "horizontalRule",
      "blockquote",
    ];

    // Helper to get speaker from the provided array (not global cache)
    const getSpeaker = (speakers: SpeakerData[], speakerId: string): SpeakerData | undefined => {
      return speakers.find(s => s.id === speakerId);
    };

    // Create all decorations: paragraph styling via node decorations + edit button widget
    // Label is rendered via CSS ::before using data-speaker-name attribute
    // speakers array is passed in directly - no global cache lookup
    const createDecorations = (doc: any, speakers: SpeakerData[]) => {
      const decorations: Decoration[] = [];
      let lastSpeakerId: string | null = null;
      let lastFaceVisible: boolean = true;
      let lastParagraphHadSpeaker = false;

      doc.descendants((node: any, pos: number) => {
        // Reset on section breaks
        if (sectionBreakNodes.includes(node.type.name)) {
          lastSpeakerId = null;
          lastFaceVisible = true;
          lastParagraphHadSpeaker = false;
          return true;
        }

        if (node.type.name === "paragraph") {
          let currentSpeakerId: string | null = null;
          let faceVisible = true;

          // Find speaker mark in this paragraph
          node.descendants((child: any) => {
            const speakerMark = child.marks?.find(
              (m: any) => m.type.name === "speaker"
            );
            if (speakerMark?.attrs.speakerId) {
              currentSpeakerId = speakerMark.attrs.speakerId;
              faceVisible = speakerMark.attrs.faceVisible !== false;
            }
          });

          if (currentSpeakerId) {
            const speaker = getSpeaker(speakers, currentSpeakerId);
            const color = speaker?.color || "#3b82f6";
            // Use speaker name if found, otherwise show the ID (not "Unknown")
            const speakerName = speaker?.name || `Speaker ${(currentSpeakerId as string).slice(-4)}`;

            // Determine if this is a "new" speaker (changed from previous paragraph)
            const isNewSpeaker =
              currentSpeakerId !== lastSpeakerId ||
              faceVisible !== lastFaceVisible ||
              !lastParagraphHadSpeaker;

            // Build node decoration attributes
            // Use data attributes for CSS-based rendering to prevent flashing
            const nodeAttrs: Record<string, string> = {
              class: isNewSpeaker ? "has-speaker has-speaker-new" : "has-speaker",
              style: `--speaker-color: ${color}`,
              "data-speaker-id": currentSpeakerId,
              "data-speaker-name": speakerName,
              "data-face-visible": String(faceVisible),
              "data-position": String(pos + 1),
            };

            // Add paragraph decoration with all attributes for CSS-based rendering
            // Speaker name is rendered via CSS ::before pseudo-element
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, nodeAttrs)
            );

            // Create edit button widget only when speaker changes
            // This is a minimal widget - name is rendered via CSS for stability
            if (isNewSpeaker) {
              const editBtn = document.createElement("button");
              editBtn.className = "speaker-edit-btn";
              editBtn.setAttribute("type", "button");
              editBtn.setAttribute("aria-label", "Edit speaker");
              editBtn.setAttribute("data-speaker-id", currentSpeakerId);
              editBtn.setAttribute("data-face-visible", String(faceVisible));
              editBtn.setAttribute("data-position", String(pos + 1));
              editBtn.contentEditable = "false";
              editBtn.style.setProperty("--speaker-color", color);

              // Pencil/edit icon
              const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
              icon.setAttribute("fill", "none");
              icon.setAttribute("viewBox", "0 0 24 24");
              icon.setAttribute("stroke-width", "1.5");
              icon.setAttribute("stroke", "currentColor");
              icon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              `;
              editBtn.appendChild(icon);

              decorations.push(
                Decoration.widget(pos + 1, editBtn, {
                  side: -1,
                  ignoreSelection: true,
                })
              );

              lastSpeakerId = currentSpeakerId;
              lastFaceVisible = faceVisible;
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

    return [
      // Main decoration plugin
      new Plugin({
        key: speakerDecorationsKey,
        state: {
          init(_, state) {
            // Start with empty speakers array - will be populated by React
            return {
              decorations: createDecorations(state.doc, []),
              speakers: [] as SpeakerData[],
            };
          },
          apply(tr, pluginState, oldState, newState) {
            // Check if speakers were updated via transaction metadata
            const meta = tr.getMeta(speakerDecorationsKey);

            if (meta?.speakers !== undefined) {
              // Speakers updated - recreate decorations with new speaker data
              return {
                decorations: createDecorations(newState.doc, meta.speakers),
                speakers: meta.speakers,
              };
            }

            if (tr.docChanged) {
              // Document changed - recreate decorations with current speaker data
              return {
                decorations: createDecorations(newState.doc, pluginState.speakers),
                speakers: pluginState.speakers,
              };
            }

            // No relevant changes - map existing decorations
            return {
              decorations: pluginState.decorations.map(tr.mapping, newState.doc),
              speakers: pluginState.speakers,
            };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations || DecorationSet.empty;
          },
          // Handle clicks on edit button via event delegation
          handleDOMEvents: {
            click(view, event) {
              const target = event.target as HTMLElement;
              const editBtn = target.closest(".speaker-edit-btn");

              if (editBtn) {
                event.preventDefault();
                event.stopPropagation();

                // Get data directly from edit button (no parent label container needed)
                const speakerId = editBtn.getAttribute("data-speaker-id");
                const faceVisible = editBtn.getAttribute("data-face-visible") !== "false";
                const position = parseInt(editBtn.getAttribute("data-position") || "0", 10);

                if (speakerId && speakerLabelClickCallback) {
                  speakerLabelClickCallback(speakerId, position, faceVisible);
                }

                return true;
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});
