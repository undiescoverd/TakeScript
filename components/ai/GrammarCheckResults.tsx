"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { Editor } from "@tiptap/core";
import { useState, useCallback, useEffect } from "react";
import { findTextPosition, highlightAndScrollTo } from "@/lib/tiptap/grammar-utils";
import { toast } from "sonner";

interface Issue {
  type: "grammar" | "spelling" | "style" | "tone" | "clarity";
  message: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
  originalText?: string;  // Text excerpt from AI
  context?: string;       // Surrounding context for disambiguation
}

interface EnrichedIssue extends Issue {
  id: string;
  from?: number;  // Tiptap position (calculated on click)
  to?: number;    // Tiptap position (calculated on click)
}

interface Props {
  issues: Issue[];
  overallScore: number;
  summary: string;
  editor: Editor | null;
  onClose: () => void;
}

export function GrammarCheckResults({
  issues,
  overallScore,
  summary,
  editor,
  onClose,
}: Props) {
  // Enrich issues with unique IDs
  const [enrichedIssues, setEnrichedIssues] = useState<EnrichedIssue[]>(() =>
    issues.map((issue, i) => ({ ...issue, id: `issue-${Date.now()}-${i}` }))
  );

  // Update enriched issues when issues prop changes
  useEffect(() => {
    setEnrichedIssues(issues.map((issue, i) => ({ ...issue, id: `issue-${Date.now()}-${i}` })));
  }, [issues]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "medium":
        return <Info className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "grammar":
        return "bg-red-500/10 text-red-500";
      case "spelling":
        return "bg-orange-500/10 text-orange-500";
      case "style":
        return "bg-blue-500/10 text-blue-500";
      case "tone":
        return "bg-purple-500/10 text-purple-500";
      case "clarity":
        return "bg-green-500/10 text-green-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Handle clicking an issue card - navigate to and highlight the text
  const handleIssueClick = useCallback((issue: EnrichedIssue) => {
    if (!editor || !issue.originalText) {
      if (!issue.originalText) {
        toast.error("Cannot locate text - missing position data");
      }
      return;
    }

    const position = findTextPosition(editor, issue.originalText, issue.context);

    if (!position) {
      toast.error("Text not found. It may have been edited since the grammar check.");
      return;
    }

    // Store position for later use (e.g., apply button)
    setEnrichedIssues(prev =>
      prev.map(i => i.id === issue.id ? { ...i, from: position.from, to: position.to } : i)
    );

    // Highlight and scroll to the text
    highlightAndScrollTo(editor, issue.id, issue.type, position.from, position.to);

    // Show feedback to user
    const message = position.confidence === "exact"
      ? "Issue located"
      : "Approximate match - text may have changed";
    toast.success(message);
  }, [editor]);

  // Handle applying a suggestion
  const handleApply = useCallback((event: React.MouseEvent, issue: EnrichedIssue) => {
    event.stopPropagation(); // Prevent card click

    if (!editor) return;

    // If we don't have positions yet, find them first
    let from = issue.from;
    let to = issue.to;

    if (!from || !to) {
      if (!issue.originalText) {
        toast.error("Cannot apply - missing text data");
        return;
      }

      const position = findTextPosition(editor, issue.originalText, issue.context);
      if (!position) {
        toast.error("Cannot apply - text not found. It may have been edited.");
        return;
      }

      from = position.from;
      to = position.to;
    }

    // Replace text with suggestion
    editor.chain()
      .focus()
      .setTextSelection({ from, to })
      .insertContent(issue.suggestion)
      .unsetMark("grammarHighlight")
      .run();

    // Remove from list
    setEnrichedIssues(prev => prev.filter(i => i.id !== issue.id));
    toast.success("Suggestion applied");
  }, [editor]);

  // Handle dismissing an issue
  const handleDismiss = useCallback((event: React.MouseEvent, issueId: string) => {
    event.stopPropagation(); // Prevent card click
    setEnrichedIssues(prev => prev.filter(i => i.id !== issueId));
    toast.info("Issue dismissed");
  }, []);

  return (
    <div className="w-96 border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Grammar & Style Check</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold">{overallScore}/10</p>
            <p className="text-xs text-muted-foreground">Overall Score</p>
          </div>
          <p className="text-sm text-muted-foreground flex-1">{summary}</p>
        </div>
      </div>

      {/* Issues */}
      <ScrollArea className="flex-1 p-4">
        {enrichedIssues.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-sm font-semibold">No issues found!</p>
            <p className="text-xs text-muted-foreground mt-1">Your script looks great.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrichedIssues.map((issue) => (
              <Card
                key={issue.id}
                className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleIssueClick(issue)}
              >
                {/* Original text excerpt */}
                {issue.originalText && (
                  <div className="mb-2 p-2 bg-muted/50 rounded border-l-2 border-destructive">
                    <p className="text-xs font-mono text-muted-foreground">
                      &ldquo;{issue.originalText}&rdquo;
                    </p>
                  </div>
                )}

                <div className="flex items-start gap-2 mb-2">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={getTypeColor(issue.type)}>
                        {issue.type}
                      </Badge>
                      <Badge variant="outline">{issue.severity}</Badge>
                    </div>
                    <p className="text-sm">{issue.message}</p>
                  </div>
                </div>

                {issue.suggestion && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                    <p className="text-xs text-muted-foreground mb-1">Suggested fix:</p>
                    <p className="text-sm font-mono text-green-700 dark:text-green-400">
                      {issue.suggestion}
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={(e) => handleApply(e, issue)}
                      >
                        Apply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDismiss(e, issue.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
