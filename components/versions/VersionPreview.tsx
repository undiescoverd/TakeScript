"use client";

import { JSONContent } from "@tiptap/react";
import { createElement } from "react";
import { getWordCount, getReadTime } from "@/lib/tiptap/export";

interface VersionPreviewProps {
  content: JSONContent;
}

/**
 * Renders a beautiful preview of version content
 * Shows content as it would appear in the editor with proper styling
 */
export function VersionPreview({ content }: VersionPreviewProps) {
  const wordCount = getWordCount(content);
  const readTime = getReadTime(content);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{wordCount} words</span>
        <span>•</span>
        <span>{readTime} min read</span>
      </div>

      {/* Content */}
      <div className="rounded-lg border bg-card p-8">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ContentRenderer node={content} />
        </div>
      </div>
    </div>
  );
}

/**
 * Recursively renders Tiptap JSON content
 */
function ContentRenderer({ node }: { node: JSONContent }) {
  if (!node) return null;

  // Handle text nodes
  if (node.type === "text") {
    let text = node.text || "";

    // Apply marks (bold, italic, etc.)
    if (node.marks) {
      node.marks.forEach((mark) => {
        switch (mark.type) {
          case "bold":
            text = text;
            break;
          case "italic":
            text = text;
            break;
          case "code":
            text = text;
            break;
        }
      });
    }

    // Apply styling based on marks
    const className = node.marks
      ?.map((mark) => {
        switch (mark.type) {
          case "bold":
            return "font-bold";
          case "italic":
            return "italic";
          case "code":
            return "rounded bg-muted px-1 py-0.5 font-mono text-sm";
          default:
            return "";
        }
      })
      .join(" ");

    return <span className={className}>{text}</span>;
  }

  // Handle block nodes
  switch (node.type) {
    case "doc":
      return (
        <>
          {node.content?.map((child, index) => (
            <ContentRenderer key={index} node={child} />
          ))}
        </>
      );

    case "paragraph":
      return (
        <p className="mb-4 leading-relaxed">
          {node.content?.map((child, index) => (
            <ContentRenderer key={index} node={child} />
          ))}
        </p>
      );

    case "heading": {
      const level = node.attrs?.level || 1;
      const headingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return createElement(
        headingTag,
        { className: "mb-3 mt-6 font-bold" },
        node.content?.map((child, index) => (
          <ContentRenderer key={index} node={child} />
        ))
      );
    }

    case "chapter":
      return (
        <div className="mb-6 mt-8 border-l-4 border-primary pl-4 py-2">
          <div className="text-lg font-bold uppercase text-primary">
            {node.attrs?.title || "Untitled Chapter"}
          </div>
          {node.attrs?.duration && (
            <div className="text-sm text-muted-foreground">
              Duration: {node.attrs.duration}
            </div>
          )}
          <div className="mt-2">
            {node.content?.map((child, index) => (
              <ContentRenderer key={index} node={child} />
            ))}
          </div>
        </div>
      );

    case "screenRecording":
      return (
        <div className="my-4 border-l-3 border-gray-500 pl-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            🖥️ Screen Recording
          </div>
          <div className="text-sm">
            {node.content?.map((child, index) => (
              <ContentRenderer key={index} node={child} />
            ))}
          </div>
        </div>
      );

    case "demonstration":
      return (
        <div className="my-4 border-l-3 border-purple-500 pl-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-500">
            🎬 Demonstration
          </div>
          <div className="text-sm">
            {node.content?.map((child, index) => (
              <ContentRenderer key={index} node={child} />
            ))}
          </div>
        </div>
      );

    case "editorNote":
      return (
        <div className="my-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950/30">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-800 dark:text-yellow-200">
            📝 Editor Note
          </div>
          <div className="text-sm text-yellow-900 dark:text-yellow-100">
            {node.content?.map((child, index) => (
              <ContentRenderer key={index} node={child} />
            ))}
          </div>
        </div>
      );

    case "bulletList":
      return (
        <ul className="mb-4 ml-6 list-disc space-y-1">
          {node.content?.map((child, index) => (
            <ContentRenderer key={index} node={child} />
          ))}
        </ul>
      );

    case "orderedList":
      return (
        <ol className="mb-4 ml-6 list-decimal space-y-1">
          {node.content?.map((child, index) => (
            <ContentRenderer key={index} node={child} />
          ))}
        </ol>
      );

    case "listItem":
      return (
        <li>
          {node.content?.map((child, index) => (
            <ContentRenderer key={index} node={child} />
          ))}
        </li>
      );

    case "blockquote":
      return (
        <blockquote className="my-4 border-l-4 border-muted pl-4 italic">
          {node.content?.map((child, index) => (
            <ContentRenderer key={index} node={child} />
          ))}
        </blockquote>
      );

    case "codeBlock":
      return (
        <pre className="my-4 overflow-x-auto rounded-lg bg-muted p-4">
          <code className="font-mono text-sm">
            {node.content?.map((child, index) => (
              <ContentRenderer key={index} node={child} />
            ))}
          </code>
        </pre>
      );

    case "hardBreak":
      return <br />;

    default:
      // For unknown node types, try to render children
      return (
        <>
          {node.content?.map((child, index) => (
            <ContentRenderer key={index} node={child} />
          ))}
        </>
      );
  }
}
