import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useSpeakerStore } from "@/store/speaker-store";

export const SpeakerPillPluginKey = new PluginKey("speakerPill");

export function createSpeakerPillPlugin() {
  return new Plugin({
    key: SpeakerPillPluginKey,

    state: {
      init() {
        return DecorationSet.empty;
      },

      apply(tr, oldDecoSet) {
        // PERFORMANCE FIX: Only recalculate decorations if document actually changed
        // or if this is a selection-only change (which doesn't need new decorations)
        if (!tr.docChanged) {
          return oldDecoSet.map(tr.mapping, tr.doc);
        }

        const decorations: Decoration[] = [];
        const doc = tr.doc;

        // Track which speaker sections we've seen to only show pill once per section
        const seenSpeakers = new Map<string, boolean>();

        doc.descendants((node, pos) => {
          // Look for paragraphs with speaker marks
          if (node.type.name === "paragraph") {
            let speakerId: string | null = null;

            // Check if this paragraph has speaker-marked text
            node.descendants((childNode) => {
              if (childNode.marks) {
                const speakerMark = childNode.marks.find(
                  (mark) => mark.type.name === "speaker"
                );
                if (speakerMark && speakerMark.attrs.speakerId) {
                  speakerId = speakerMark.attrs.speakerId;
                }
              }
            });

            // If this paragraph has a speaker and we haven't seen this speaker yet in this position
            if (speakerId) {
              const key = `${speakerId}-${pos}`;

              // Check if the previous paragraph has the same speaker
              const prevNode = pos > 0 ? doc.resolve(pos - 1).parent : null;
              let prevHasSameSpeaker = false;

              if (prevNode && prevNode.type.name === "paragraph") {
                prevNode.descendants((childNode) => {
                  if (childNode.marks) {
                    const prevSpeakerMark = childNode.marks.find(
                      (mark) => mark.type.name === "speaker"
                    );
                    if (
                      prevSpeakerMark &&
                      prevSpeakerMark.attrs.speakerId === speakerId
                    ) {
                      prevHasSameSpeaker = true;
                    }
                  }
                });
              }

              // Only add decoration if this is the first paragraph of a speaker section
              if (!prevHasSameSpeaker) {
                const widget = document.createElement("div");
                widget.className = "speaker-pill-widget";
                widget.setAttribute("data-speaker-id", speakerId);
                widget.setAttribute("contenteditable", "false");

                // This will be styled with CSS and populated by React component
                const decoration = Decoration.widget(pos, widget, {
                  side: -1,
                });

                decorations.push(decoration);
              }
            }
          }
        });

        return DecorationSet.create(doc, decorations);
      },
    },

    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}
