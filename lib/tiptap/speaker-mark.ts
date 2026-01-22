import { Mark, mergeAttributes, getMarkRange } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Fragment, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

// Camera mode types
export type CameraMode = "full" | "corner" | "voiceover";
export type CameraModeNullable = CameraMode | null;

// Display labels for camera modes (used in editor UI)
export const cameraModeLabels: Record<CameraMode, string> = {
  full: "Full Screen",
  corner: "Corner",
  voiceover: "Voiceover",
};

// Camera mode colors - distinct from speaker colors and each other for easy scanning
// Speaker colors: blue, purple, green, amber, red, pink, cyan, lime
// Camera colors use maximally distinct ranges for easy visual identification
export const cameraModeColors: Record<CameraMode, string> = {
  full: "#06b6d4", // cyan-500 - vibrant teal/cyan for full screen
  corner: "#f97316", // orange-500 - warm orange for corner view
  voiceover: "#a855f7", // purple-500 - vibrant purple for voiceover
};

// Speaker interface
export interface Speaker {
  id: string;
  name: string;
  color: string;
  defaultVisibility?: CameraModeNullable;
}

export interface SpeakerMarkOptions {
  HTMLAttributes: Record<string, unknown>;
  getSpeakers: () => Speaker[];
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    speakerMark: {
      /**
       * Set a speaker mark on the selection (no default camera mode)
       */
      setSpeaker: (attributes: {
        speakerId: string;
        cameraMode?: CameraModeNullable;
      }) => ReturnType;
      /**
       * Set camera mode on existing speaker mark (requires speaker to exist)
       */
      setCameraMode: (cameraMode: CameraModeNullable) => ReturnType;
      /**
       * Toggle a speaker mark
       */
      toggleSpeaker: (attributes: {
        speakerId: string;
        cameraMode?: CameraModeNullable;
      }) => ReturnType;
      /**
       * Remove speaker mark from selection (removes both speaker and camera)
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
): { speakerId: string; cameraMode: CameraModeNullable } | null {
  let result: { speakerId: string; cameraMode: CameraModeNullable } | null = null;

  node.descendants((child) => {
    if (result) return false; // Stop if we found one

    if (child.isText) {
      const speakerMark = child.marks.find((m) => m.type.name === "speaker");
      if (speakerMark) {
        result = {
          speakerId: speakerMark.attrs.speakerId,
          cameraMode: speakerMark.attrs.cameraMode || null,
        };
        return false;
      }
    }
    return true;
  });

  return result;
}

// Block types that need extra margin for following speaker labels
const BLOCK_TYPES = new Set([
  "chapter",
  "screenRecording",
  "demonstration",
  "thumbnailTitle",
]);

/**
 * Build decorations for paragraphs with speaker marks
 * Shows both labels when EITHER speaker or camera changes, OR when following a block
 */
function buildDecorations(
  doc: ProseMirrorNode,
  getSpeakers: () => Speaker[]
): DecorationSet {
  const decorations: Decoration[] = [];
  const speakers = getSpeakers();
  let prevSpeakerId: string | null = null;
  let prevCameraMode: CameraModeNullable = null;
  let lastBlockEndPos = -1; // Track where the last block ended

  doc.descendants((node, pos) => {
    // Track when we see a block type and where it ends
    // We still descend into blocks to decorate their inner paragraphs
    if (BLOCK_TYPES.has(node.type.name)) {
      lastBlockEndPos = pos + node.nodeSize;
      // Reset speaker tracking when entering a block (each block is its own context)
      prevSpeakerId = null;
      prevCameraMode = null;
      // Continue descending to process paragraphs inside the block
      return true;
    }

    if (node.type.name === "paragraph") {
      const speakerInfo = findSpeakerInParagraph(node);

      // Check if this paragraph directly follows a block
      const isDirectlyAfterBlock = pos === lastBlockEndPos;

      if (speakerInfo) {
        const { speakerId, cameraMode } = speakerInfo;
        const speaker = speakers.find((s) => s.id === speakerId);

        // Track changes independently
        const speakerChanged = speakerId !== prevSpeakerId;
        const cameraChanged = cameraMode !== prevCameraMode;

        // Show both labels when EITHER changes OR when following a block
        const showLabels = speakerChanged || cameraChanged || isDirectlyAfterBlock;

        const speakerName = speaker?.name.toUpperCase() || "UNKNOWN";
        // Calculate camera label left position based on speaker name length
        // Each character is approximately 0.45rem in uppercase with letter-spacing
        // Plus padding (14px * 2 = 28px = ~1.75rem) and gap (~0.5rem)
        const speakerLabelWidth = speakerName.length * 0.45 + 1.75 + 0.5;

        const attrs: Record<string, string> = {
          "data-paragraph-speaker": speakerId,
          "data-speaker-name": speakerName,
          style: `--speaker-color: ${speaker?.color || "#3b82f6"}; --camera-label-left: ${speakerLabelWidth}rem`,
        };

        // Show speaker label when needed
        if (showLabels) {
          attrs["data-show-speaker-label"] = "true";
        }

        // Mark if following a block (for extra margin in CSS)
        if (isDirectlyAfterBlock) {
          attrs["data-after-block"] = "true";
        }

        // Only add camera attributes if camera mode is assigned
        if (cameraMode !== null) {
          attrs["data-camera-mode"] = cameraModeLabels[cameraMode];
          // Append camera color CSS variable to existing style (camera-label-left already set above)
          attrs.style = `${attrs.style}; --camera-color: ${cameraModeColors[cameraMode]}`;
          // Show camera label when needed (and camera is assigned)
          if (showLabels) {
            attrs["data-show-camera-label"] = "true";
          }
        }

        decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
        prevSpeakerId = speakerId;
        prevCameraMode = cameraMode;
      } else {
        // Reset tracking when we hit a non-speaker paragraph
        prevSpeakerId = null;
        prevCameraMode = null;
      }
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Helper function to handle speaker shortcuts (Mod-1 through Mod-4)
 * When selection exists: applies speaker to selection
 * When no selection: sets pending speaker for next typed text
 */
function handleSpeakerShortcut(
  editor: any,
  speaker: Speaker,
  markName: string
): boolean {
  const { selection } = editor.state;
  const { from, to } = selection;
  const speakerStore = typeof window !== "undefined" ? (window as any).__speakerStore : null;

  // Check if there's a text selection
  if (from !== to) {
    // Selection exists - apply speaker to selection normally
    const result = editor.commands.setSpeaker({
      speakerId: speaker.id,
      cameraMode: speaker.defaultVisibility || null,
    });
    if (result && speakerStore) {
      speakerStore.setLastUsed(speaker.id, speaker.defaultVisibility || null);
      speakerStore.clearPendingSpeaker();
    }
    return result;
  }

  // No selection - handle pending speaker
  if (!speakerStore) return false;

  const currentPendingSpeakerId = speakerStore.pendingSpeakerId;
  const cameraMode = speaker.defaultVisibility || null;

  if (currentPendingSpeakerId === speaker.id) {
    // Same speaker pressed again - toggle off (clear pending)
    speakerStore.clearPendingSpeaker();
    // Also clear stored marks in the editor
    editor.commands.unsetMark(markName);
    return true;
  }

  // Set pending speaker and stored marks for next typed text
  speakerStore.setPendingSpeaker(speaker.id, cameraMode);
  speakerStore.setLastUsed(speaker.id, cameraMode);

  // Set stored marks so typed text gets the speaker mark
  const result = editor.commands.setSpeaker({
    speakerId: speaker.id,
    cameraMode: cameraMode,
  });

  return result;
}

/**
 * Find the full range of a speaker mark at a given position
 * Returns the from/to positions and the mark itself, or null if no speaker mark found
 */
function findSpeakerMarkRange(
  state: any,
  pos: number
): { from: number; to: number; speakerId: string; cameraMode: CameraModeNullable } | null {
  const $pos = state.doc.resolve(pos);
  const markType = state.schema.marks.speaker;

  // Use getMarkRange to find the extent of the mark
  const range = getMarkRange($pos, markType);
  if (!range) return null;

  // Get the mark attributes
  const mark = $pos.marks().find((m: any) => m.type === markType);
  if (!mark) return null;

  return {
    from: range.from,
    to: range.to,
    speakerId: mark.attrs.speakerId,
    cameraMode: mark.attrs.cameraMode ?? null,
  };
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
        // Rebuild decorations when doc changes OR when speakers are updated
        if (tr.docChanged || tr.getMeta("speakersUpdated")) {
          return buildDecorations(tr.doc, getSpeakers);
        }
        return oldSet;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
      handleDOMEvents: {
        click: (view, event) => {
          // Check if click target or its parent is the paragraph with labels
          const target = event.target as HTMLElement;
          const paragraphEl = target.closest("p[data-paragraph-speaker]") as HTMLElement;

          if (!paragraphEl) return false;

          // Only handle if labels are shown
          const showsSpeakerLabel = paragraphEl.hasAttribute("data-show-speaker-label");
          const showsCameraLabel = paragraphEl.hasAttribute("data-show-camera-label");
          if (!showsSpeakerLabel && !showsCameraLabel) return false;

          // Get paragraph rect for click detection
          const rect = paragraphEl.getBoundingClientRect();
          const labelZoneTop = rect.top - 28; // Labels at top: -1.75rem = 28px
          const labelZoneBottom = rect.top;

          // Check if click is in label zone (above the paragraph)
          if (event.clientY < labelZoneTop || event.clientY > labelZoneBottom) {
            return false;
          }

          // Calculate which label was clicked based on X position
          const speakerName = paragraphEl.getAttribute("data-speaker-name") || "";
          const cameraMode = paragraphEl.getAttribute("data-camera-mode");
          const speakerId = paragraphEl.getAttribute("data-paragraph-speaker");
          const clickX = event.clientX - rect.left;

          // Estimate speaker label width (char width ~7.2px for 0.65rem font + padding 28px)
          const speakerLabelWidth = speakerName.length * 7.2 + 28;

          // Find the paragraph position in the document
          const pos = view.posAtDOM(paragraphEl, 0);
          if (pos === null || pos === undefined) return false;

          const { state, dispatch } = view;
          const $pos = state.doc.resolve(pos);
          const paragraphStart = $pos.start($pos.depth);

          if (showsSpeakerLabel && clickX < speakerLabelWidth) {
            // Clicked speaker label - cycle speaker
            const speakers = getSpeakers();
            if (speakers.length === 0) return false;

            const currentIndex = speakers.findIndex((s) => s.id === speakerId);
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % speakers.length;
            const nextSpeaker = speakers[nextIndex];

            // Find mark range and apply new speaker
            const markRange = findSpeakerMarkRange(state, paragraphStart + 1);
            if (markRange) {
              const tr = state.tr;
              const markType = state.schema.marks.speaker;
              const newMark = markType.create({
                speakerId: nextSpeaker.id,
                cameraMode: markRange.cameraMode, // Preserve camera mode
              });

              tr.removeMark(markRange.from, markRange.to, markType);
              tr.addMark(markRange.from, markRange.to, newMark);
              dispatch(tr);
              event.preventDefault();
              return true;
            }
          } else if (showsCameraLabel && cameraMode) {
            // Clicked camera label - cycle camera mode
            const cycleOrder: (CameraMode | null)[] = ["full", "voiceover", "corner", null];

            // Find mark range to get current camera mode
            const markRange = findSpeakerMarkRange(state, paragraphStart + 1);
            if (markRange) {
              const currentCameraMode = (markRange.cameraMode ?? null) as CameraModeNullable;
              const currentIndex = cycleOrder.indexOf(currentCameraMode);
              const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cycleOrder.length;
              const newCameraMode = cycleOrder[nextIndex];

              const tr = state.tr;
              const markType = state.schema.marks.speaker;
              const newMark = markType.create({
                speakerId: markRange.speakerId, // Preserve speaker
                cameraMode: newCameraMode,
              });

              tr.removeMark(markRange.from, markRange.to, markType);
              tr.addMark(markRange.from, markRange.to, newMark);
              dispatch(tr);
              event.preventDefault();
              return true;
            }
          }

          return false;
        },
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
        default: null as CameraModeNullable,
        parseHTML: (element) => {
          const mode = element.getAttribute("data-camera-mode");
          return mode || null;
        },
        renderHTML: (attributes) => {
          // Don't render attribute if camera mode is null
          if (!attributes.cameraMode) {
            return {};
          }
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
        ({ tr, state, dispatch, chain }) => {
          const { selection } = state;
          const { $from, $to, from, to } = selection;

          // Check if selection is empty
          if (from === to) {
            // No selection - just set the mark at cursor
            return chain()
              .unsetMark(this.name)
              .setMark(this.name, {
                speakerId: attributes.speakerId,
                cameraMode: attributes.cameraMode ?? null, // No default camera
              })
              .run();
          }

          // Check if selection spans multiple blocks (paragraphs)
          // If so, use default setMark behavior
          if ($from.parent !== $to.parent) {
            return chain()
              .unsetMark(this.name)
              .setMark(this.name, {
                speakerId: attributes.speakerId,
                cameraMode: attributes.cameraMode ?? null, // No default camera
              })
              .run();
          }

          // Find paragraph boundaries
          const paragraphStart = $from.start($from.depth);
          const paragraphEnd = $to.end($to.depth);

          // Check if selection spans the entire paragraph content
          const selectionStartsAtParagraphStart = from === paragraphStart;
          const selectionEndsAtParagraphEnd = to === paragraphEnd;

          // If selection covers whole paragraph, just apply the mark
          // First unset any existing speaker mark to ensure proper replacement
          if (selectionStartsAtParagraphStart && selectionEndsAtParagraphEnd) {
            return chain()
              .unsetMark(this.name)
              .setMark(this.name, {
                speakerId: attributes.speakerId,
                cameraMode: attributes.cameraMode ?? null, // No default camera
              })
              .run();
          }

          // Selection is partial within a single paragraph - need to split
          if (!dispatch) return true;

          // We need to handle three cases:
          // 1. Selection starts in middle, ends at end -> split at start
          // 2. Selection starts at start, ends in middle -> split at end
          // 3. Selection is in middle -> split at both ends

          const markType = state.schema.marks[this.name];
          const mark = markType.create({
            speakerId: attributes.speakerId,
            cameraMode: attributes.cameraMode ?? null, // No default camera
          });

          // Get paragraph node type
          const paragraphType = state.schema.nodes.paragraph;
          if (!paragraphType) return false;

          // Build the transaction step by step
          // We need to:
          // 1. Delete the selected content
          // 2. Replace with split paragraphs containing the content with marks

          const selectedText = state.doc.textBetween(from, to, "", "");
          const textBefore = state.doc.textBetween(paragraphStart, from, "", "");
          const textAfter = state.doc.textBetween(to, paragraphEnd, "", "");

          // Build the replacement content
          const nodes: ProseMirrorNode[] = [];

          // Text before selection (if any) goes in its own paragraph
          if (textBefore.length > 0) {
            // Get marks from the original text before selection
            const originalMarks = $from.parent.child(0)?.marks || [];
            const textNode = state.schema.text(textBefore, originalMarks.filter(m => m.type.name !== "speaker"));
            nodes.push(paragraphType.create(null, textNode));
          }

          // Selected text gets the speaker mark in its own paragraph
          if (selectedText.length > 0) {
            const textNode = state.schema.text(selectedText, [mark]);
            nodes.push(paragraphType.create(null, textNode));
          }

          // Text after selection (if any) goes in its own paragraph
          if (textAfter.length > 0) {
            const originalMarks = $to.parent.lastChild?.marks || [];
            const textNode = state.schema.text(textAfter, originalMarks.filter(m => m.type.name !== "speaker"));
            nodes.push(paragraphType.create(null, textNode));
          }

          // Find the paragraph boundaries for replacement
          const $startBlock = state.doc.resolve(paragraphStart);
          const blockStart = $startBlock.before($startBlock.depth);
          const blockEnd = blockStart + $from.parent.nodeSize;

          // Create fragment from nodes
          const replacementFragment = Fragment.from(nodes);

          tr.replaceWith(blockStart, blockEnd, replacementFragment);

          // Set cursor position to end of the marked paragraph
          const markedParagraphIndex = textBefore.length > 0 ? 1 : 0;
          let cursorPos = blockStart;
          for (let i = 0; i <= markedParagraphIndex && i < nodes.length; i++) {
            if (i < markedParagraphIndex) {
              cursorPos += nodes[i].nodeSize;
            } else {
              cursorPos += 1 + selectedText.length; // +1 for paragraph opening
            }
          }
          tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)));

          dispatch(tr);
          return true;
        },

      toggleSpeaker:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, {
            speakerId: attributes.speakerId,
            cameraMode: attributes.cameraMode ?? null, // No default camera
          });
        },

      setCameraMode:
        (cameraMode) =>
        ({ state, chain, dispatch }) => {
          const { selection } = state;
          const { $from, from, to } = selection;

          // Check if current position has speaker mark
          const speakerMark = $from.marks().find((m) => m.type.name === "speaker");

          // Camera mode requires an existing speaker - silent fail if none
          if (!speakerMark) {
            return false;
          }

          // Ensure we're updating the mark across the entire selection
          // Use setMark which will replace any existing speaker mark with the new camera mode
          const result = chain()
            .setMark("speaker", {
              speakerId: speakerMark.attrs.speakerId,
              cameraMode: cameraMode,
            })
            .run();

          return result;
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

      // Speaker cycling shortcut (Cmd+9)
      // Cycles through all available speakers
      // When selection exists: applies speaker to selection, then cycles on repeat
      // When cursor inside marked text (no selection): cycles speaker for entire mark range
      // When no selection and no mark: sets pending speaker for next typed text
      // When no speakers exist: opens the Add Speaker dialog
      "Mod-9": ({ editor }) => {
        const speakers = this.options.getSpeakers();
        if (speakers.length === 0) {
          // No speakers - open the Add Speaker sidebar/dialog
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("speaker:openSidebar"));
          }
          return true;
        }

        const speakerStore = typeof window !== "undefined" ? (window as any).__speakerStore : null;
        const { selection, tr } = editor.state;
        const { $from, from, to } = selection;

        // Find current speaker (from selection or pending)
        let currentSpeakerId: string | null = null;
        let currentCameraMode: CameraModeNullable = null;

        // Check if there's a speaker mark at cursor
        const existingMark = $from.marks().find((m) => m.type.name === "speaker");
        if (existingMark) {
          currentSpeakerId = existingMark.attrs.speakerId;
          currentCameraMode = existingMark.attrs.cameraMode ?? null;
        } else if (speakerStore?.pendingSpeakerId) {
          currentSpeakerId = speakerStore.pendingSpeakerId;
        }

        // Find next speaker in cycle
        let nextSpeakerIndex = 0;
        if (currentSpeakerId) {
          const currentIndex = speakers.findIndex((s: Speaker) => s.id === currentSpeakerId);
          if (currentIndex !== -1) {
            nextSpeakerIndex = (currentIndex + 1) % speakers.length;
          }
        }

        const nextSpeaker = speakers[nextSpeakerIndex];

        // NEW: Special case - cursor inside marked text with no selection
        // Apply cycled speaker to entire mark range instead of setting pending
        if (from === to && existingMark) {
          const markRange = findSpeakerMarkRange(editor.state, from);
          if (markRange) {
            // Apply new speaker to the full marked range, preserving camera mode
            const result = editor.chain()
              .setTextSelection({ from: markRange.from, to: markRange.to })
              .setSpeaker({
                speakerId: nextSpeaker.id,
                cameraMode: currentCameraMode, // Preserve existing camera mode
              })
              .setTextSelection(from) // Restore cursor position
              .run();

            if (result && speakerStore) {
              speakerStore.setLastUsed(nextSpeaker.id, currentCameraMode);
            }
            return result;
          }
        }

        // Original behavior for selection or no mark
        return handleSpeakerShortcut(editor, nextSpeaker, this.name);
      },

      // Camera mode cycling shortcut (Cmd+0)
      // Cycles through: full → voiceover → corner → null (remove) → full...
      "Mod-0": ({ editor }) => {
        const { selection } = editor.state;
        const { $from, from, to } = selection;
        const speakerMark = $from.marks().find((m) => m.type.name === "speaker");

        // Camera mode requires an existing speaker
        if (!speakerMark) {
          return false;
        }

        // Define cycle order: full → voiceover → corner → null → full...
        const cycleOrder: (CameraMode | null)[] = ["full", "voiceover", "corner", null];
        // Normalize undefined to null for consistent comparison
        const rawCameraMode = speakerMark.attrs.cameraMode;
        const currentCameraMode = (rawCameraMode ?? null) as CameraModeNullable;

        // Find current position in cycle and get next
        // If not found (shouldn't happen, but handle gracefully), start at "full" (index 0)
        const currentIndex = cycleOrder.indexOf(currentCameraMode);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cycleOrder.length;
        const newCameraMode = cycleOrder[nextIndex];

        // NEW: When cursor inside marked text (no selection), find full range and apply to entire range
        if (from === to) {
          const markRange = findSpeakerMarkRange(editor.state, from);
          if (markRange) {
            // Apply new camera mode to the full marked range, preserving speaker
            const result = editor.chain()
              .setTextSelection({ from: markRange.from, to: markRange.to })
              .setSpeaker({
                speakerId: markRange.speakerId,
                cameraMode: newCameraMode,
              })
              .setTextSelection(from) // Restore cursor position
              .run();

            // Track last used camera mode
            if (result && typeof window !== "undefined" && (window as any).__speakerStore) {
              (window as any).__speakerStore.setLastUsed(markRange.speakerId, newCameraMode);
            }

            return result;
          }
        }

        // Original behavior with selection - use setCameraMode command
        const result = editor.commands.setCameraMode(newCameraMode);

        // Track last used camera mode
        if (result && typeof window !== "undefined" && (window as any).__speakerStore) {
          (window as any).__speakerStore.setLastUsed(speakerMark.attrs.speakerId, newCameraMode);
        }

        return result;
      },

      // Remove speaker and camera (Cmd+J)
      // Also clears pending speaker if set
      "Mod-j": ({ editor }) => {
        // Clear pending speaker
        if (typeof window !== "undefined" && (window as any).__speakerStore) {
          (window as any).__speakerStore.clearPendingSpeaker();
        }
        return editor.commands.unsetSpeaker();
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
