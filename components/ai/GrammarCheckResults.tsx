"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

interface Issue {
  type: "grammar" | "spelling" | "style" | "tone" | "clarity";
  message: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
}

interface Props {
  issues: Issue[];
  overallScore: number;
  summary: string;
  onApplySuggestion?: (suggestion: string) => void;
  onClose: () => void;
}

export function GrammarCheckResults({
  issues,
  overallScore,
  summary,
  onApplySuggestion,
  onClose,
}: Props) {
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
        {issues.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-sm font-semibold">No issues found!</p>
            <p className="text-xs text-muted-foreground mt-1">Your script looks great.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue, index) => (
              <Card key={index} className="p-3">
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
                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                    <p className="font-semibold mb-1">Suggestion:</p>
                    <p>{issue.suggestion}</p>
                    {onApplySuggestion && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => onApplySuggestion(issue.suggestion)}
                      >
                        Apply Suggestion
                      </Button>
                    )}
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
