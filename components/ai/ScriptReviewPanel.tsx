"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { X, TrendingUp, AlertTriangle } from "lucide-react";

interface Suggestion {
  chapter: string;
  suggestion: string;
  priority: "low" | "medium" | "high";
}

interface ScoreSection {
  score: number;
  notes: string;
}

interface Props {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  suggestions: Suggestion[];
  toneCompliance: ScoreSection;
  pacing: ScoreSection;
  clarity: ScoreSection;
  onClose: () => void;
}

export function ScriptReviewPanel({
  overallScore,
  strengths,
  improvements,
  suggestions,
  toneCompliance,
  pacing,
  clarity,
  onClose,
}: Props) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 6) return "text-yellow-500";
    return "text-red-500";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500";
      default:
        return "bg-blue-500/10 text-blue-500";
    }
  };

  return (
    <div className="w-96 border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Script Review</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-center mb-4">
          <p className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}/10
          </p>
          <p className="text-xs text-muted-foreground">Overall Score</p>
        </div>

        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Tone Compliance</span>
              <span className={getScoreColor(toneCompliance.score)}>
                {toneCompliance.score}/10
              </span>
            </div>
            <Progress value={toneCompliance.score * 10} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Pacing</span>
              <span className={getScoreColor(pacing.score)}>{pacing.score}/10</span>
            </div>
            <Progress value={pacing.score * 10} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Clarity</span>
              <span className={getScoreColor(clarity.score)}>{clarity.score}/10</span>
            </div>
            <Progress value={clarity.score * 10} />
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Strengths */}
          {strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <h4 className="font-semibold text-sm">Strengths</h4>
              </div>
              <ul className="space-y-2">
                {strengths.map((strength, index) => (
                  <li key={index} className="text-sm pl-2 border-l-2 border-green-500">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {improvements.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <h4 className="font-semibold text-sm">Areas for Improvement</h4>
              </div>
              <ul className="space-y-2">
                {improvements.map((improvement, index) => (
                  <li key={index} className="text-sm pl-2 border-l-2 border-yellow-500">
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Chapter Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3">Chapter Suggestions</h4>
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <Badge variant="outline" className={getPriorityColor(suggestion.priority)}>
                        {suggestion.priority}
                      </Badge>
                      <span className="font-medium text-sm">{suggestion.chapter}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{suggestion.suggestion}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Notes */}
          <div className="space-y-3">
            {toneCompliance.notes && (
              <Card className="p-3">
                <h5 className="font-semibold text-xs mb-1">Tone & Voice</h5>
                <p className="text-xs text-muted-foreground">{toneCompliance.notes}</p>
              </Card>
            )}
            {pacing.notes && (
              <Card className="p-3">
                <h5 className="font-semibold text-xs mb-1">Pacing</h5>
                <p className="text-xs text-muted-foreground">{pacing.notes}</p>
              </Card>
            )}
            {clarity.notes && (
              <Card className="p-3">
                <h5 className="font-semibold text-xs mb-1">Clarity</h5>
                <p className="text-xs text-muted-foreground">{clarity.notes}</p>
              </Card>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
