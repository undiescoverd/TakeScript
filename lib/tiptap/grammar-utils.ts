import { Editor } from "@tiptap/core";

/**
 * Normalize text for comparison by trimming, lowercasing, and collapsing whitespace
 */
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find the position of target text in the Tiptap document
 * Uses fuzzy text search with context scoring for disambiguation
 *
 * @param editor - The Tiptap editor instance
 * @param targetText - The text to search for (15-50 characters)
 * @param context - Optional surrounding context for disambiguation
 * @returns Position object with from/to positions and confidence level, or null if not found
 */
export function findTextPosition(
  editor: Editor,
  targetText: string,
  context?: string
): { from: number; to: number; confidence: "exact" | "fuzzy" } | null {
  const { state } = editor;
  const normalizedTarget = normalize(targetText);

  // Build full text from document with position mapping
  let fullText = "";
  const charToPos: number[] = []; // Maps text character index to Tiptap position

  state.doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        charToPos.push(pos + i);
      }
      fullText += node.text;
    }
  });

  // Search for target text (case-insensitive, whitespace-normalized)
  const normalizedFull = normalize(fullText);
  const matches: Array<{ from: number; to: number; score: number }> = [];

  let searchIndex = 0;
  while (searchIndex < normalizedFull.length) {
    const foundIndex = normalizedFull.indexOf(normalizedTarget, searchIndex);
    if (foundIndex === -1) break;

    // Map back to Tiptap positions
    const from = charToPos[foundIndex] || 0;
    const toIndex = foundIndex + normalizedTarget.length - 1;
    const to = charToPos[toIndex] !== undefined ? charToPos[toIndex] + 1 : from;

    // Score match (higher score if context matches)
    let score = 100;
    if (context) {
      const surroundingStart = Math.max(0, foundIndex - 50);
      const surroundingEnd = Math.min(fullText.length, foundIndex + targetText.length + 50);
      const surrounding = fullText.slice(surroundingStart, surroundingEnd);

      if (normalize(surrounding).includes(normalize(context))) {
        score += 50; // Boost score if context matches
      }
    }

    matches.push({ from, to, score });
    searchIndex = foundIndex + 1;
  }

  if (matches.length === 0) return null;

  // Return best match (highest score)
  matches.sort((a, b) => b.score - a.score);
  return {
    from: matches[0].from,
    to: matches[0].to,
    confidence: matches.length === 1 ? "exact" : "fuzzy",
  };
}

/**
 * Highlight grammar issue and scroll to it in the editor
 * Clears any previous grammar highlights (temporary UX)
 *
 * @param editor - The Tiptap editor instance
 * @param issueId - Unique ID for this grammar issue
 * @param issueType - Type of issue (grammar/spelling/style/tone/clarity)
 * @param from - Start position in document
 * @param to - End position in document
 */
export function highlightAndScrollTo(
  editor: Editor,
  issueId: string,
  issueType: string,
  from: number,
  to: number
) {
  // Clear previous highlight (temporary UX - only one highlight at a time)
  editor.chain().focus().unsetMark("grammarHighlight").run();

  // Apply new highlight
  editor
    .chain()
    .focus()
    .setTextSelection({ from, to })
    .setGrammarHighlight({ issueId, issueType })
    .run();

  // Scroll to center the highlighted text
  setTimeout(() => {
    try {
      const { view } = editor;
      const coords = view.coordsAtPos(from);

      // Find scroll container (could be ProseMirror container or parent)
      const scrollContainer = view.dom.closest(".ProseMirror-scroll-container") || view.dom.parentElement;

      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetY = coords.top - containerRect.top - containerRect.height / 2;

        // Smooth scroll to center the text
        scrollContainer.scrollBy({
          top: targetY,
          behavior: "smooth"
        });
      }
    } catch (error) {
      console.error("Error scrolling to grammar issue:", error);
    }
  }, 50); // Small delay to ensure DOM is updated
}

/**
 * Clear all grammar highlights from the document
 *
 * @param editor - The Tiptap editor instance
 */
export function clearAllGrammarHighlights(editor: Editor) {
  editor.chain().focus().unsetMark("grammarHighlight").run();
}

/**
 * Validate if a position is still valid in the current document
 * Checks if the text at the position matches the expected text
 *
 * @param editor - The Tiptap editor instance
 * @param from - Start position
 * @param to - End position
 * @param expectedText - The expected text at this position
 * @returns True if position is valid and text matches
 */
export function isPositionValid(
  editor: Editor,
  from: number,
  to: number,
  expectedText: string
): boolean {
  try {
    const currentText = editor.state.doc.textBetween(from, to);
    return normalize(currentText) === normalize(expectedText);
  } catch {
    return false;
  }
}
