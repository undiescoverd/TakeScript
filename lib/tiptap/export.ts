import { JSONContent } from "@tiptap/react";

/**
 * Export Tiptap document to plain text for teleprompter (PrompSmart)
 * Excludes editor notes and strips formatting
 */
export function exportToPlainText(doc: JSONContent): string {
  const lines: string[] = [];

  function extractText(node: JSONContent): void {
    // Handle text nodes
    if (node.type === "text" && node.text) {
      return;
    }

    // Handle different block types
    switch (node.type) {
      case "doc":
        node.content?.forEach(extractText);
        break;

      case "chapter":
        if (node.attrs?.title) {
          lines.push("");
          lines.push(`[${node.attrs.title.toUpperCase()}]`);
          if (node.attrs.duration) {
            lines.push(`(${node.attrs.duration})`);
          }
          lines.push("");
        }
        node.content?.forEach(extractText);
        break;

      case "screenRecording":
        lines.push("");
        lines.push("[SCREEN RECORDING]");
        const screenText = getTextContent(node);
        if (screenText) {
          lines.push(screenText);
        }
        lines.push("");
        break;

      case "demonstration":
        lines.push("");
        lines.push("[DEMONSTRATION]");
        const demoText = getTextContent(node);
        if (demoText) {
          lines.push(demoText);
        }
        lines.push("");
        break;

      case "paragraph":
        const text = getTextContent(node);
        if (text) {
          lines.push(text);
        }
        break;

      case "heading":
        const headingText = getTextContent(node);
        if (headingText) {
          lines.push("");
          lines.push(headingText.toUpperCase());
          lines.push("");
        }
        break;

      case "bulletList":
      case "orderedList":
        node.content?.forEach((item, index) => {
          const itemText = getTextContent(item);
          if (itemText) {
            const prefix =
              node.type === "orderedList" ? `${index + 1}. ` : "• ";
            lines.push(prefix + itemText);
          }
        });
        break;

      case "listItem":
        node.content?.forEach(extractText);
        break;

      case "blockquote":
        const quoteText = getTextContent(node);
        if (quoteText) {
          lines.push(`"${quoteText}"`);
        }
        break;

      case "hardBreak":
        lines.push("");
        break;

      default:
        // Recursively process unknown nodes
        node.content?.forEach(extractText);
    }
  }

  extractText(doc);

  // Clean up: remove excessive blank lines
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Get plain text content from a node and its children
 */
function getTextContent(node: JSONContent): string {
  if (node.type === "text" && node.text) {
    return node.text;
  }

  if (node.content) {
    return node.content.map(getTextContent).join("");
  }

  return "";
}

/**
 * Calculate word count from Tiptap document
 */
export function getWordCount(doc: JSONContent): number {
  const text = exportToPlainText(doc);
  const words = text.match(/\b\w+\b/g);
  return words ? words.length : 0;
}

/**
 * Calculate estimated read time in minutes
 * Based on average speaking rate of 150 words per minute
 */
export function getReadTime(doc: JSONContent): number {
  const wordCount = getWordCount(doc);
  return Math.ceil(wordCount / 150);
}

/**
 * Extract all chapters from a Tiptap document
 */
export function extractChapters(
  doc: JSONContent
): Array<{ title: string; duration?: string; id: string }> {
  const chapters: Array<{ title: string; duration?: string; id: string }> = [];

  function findChapters(node: JSONContent): void {
    if (node.type === "chapter" && node.attrs?.title) {
      chapters.push({
        title: node.attrs.title,
        duration: node.attrs.duration,
        id: node.attrs.id || `chapter-${chapters.length}`,
      });
    }

    node.content?.forEach(findChapters);
  }

  findChapters(doc);
  return chapters;
}
