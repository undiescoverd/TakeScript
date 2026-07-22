"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Highlighter,
  X,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPinOff,
} from "lucide-react";
import { formatDistanceToNow } from "@/lib/utils";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor-store";
import { annotationColors, AnnotationColor } from "@/lib/tiptap/annotation-mark";
import { findAnnotationRange } from "@/lib/tiptap/find-annotation-range";
import {
  suggestionEligibility,
  selectNewestBatchTargets,
} from "@/lib/annotations/suggestion-selectors";
import type { ApplicableAnnotation } from "@/hooks/use-apply-suggestions";
import { Editor } from "@tiptap/react";

interface AnnotationsPanelProps {
  scriptId: Id<"scripts">;
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
  /** Apply a single anchored AI suggestion. Provided by useApplySuggestions. */
  onApplyOne?: (annotation: ApplicableAnnotation) => void;
  /** Apply every anchored suggestion in the newest batch as one undo step. */
  onApplyAll?: (annotations: ApplicableAnnotation[]) => void;
}

export function AnnotationsPanel({
  scriptId,
  isOpen,
  onClose,
  editor,
  onApplyOne,
  onApplyAll,
}: AnnotationsPanelProps) {
  const annotations = useQuery(api.annotations.list, { scriptId });
  const updateAnnotation = useMutation(api.annotations.update);
  const toggleResolve = useMutation(api.annotations.toggleResolve);
  const removeAnnotation = useMutation(api.annotations.remove);

  const { selectedAnnotationId, setSelectedAnnotationId } = useEditorStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const handleToggleResolve = async (annotationId: Id<"annotations">) => {
    try {
      await toggleResolve({ annotationId });
    } catch {
      toast.error("Failed to update annotation");
    }
  };

  const handleDelete = async (annotationId: Id<"annotations">) => {
    try {
      // Remove the mark from the editor
      if (editor && editor.view) {
        try {
          editor.commands.removeAnnotation(annotationId);
        } catch {
          // Editor view not ready, continue with deletion anyway
        }
      }
      await removeAnnotation({ annotationId });
      toast.success("Annotation deleted");
    } catch {
      toast.error("Failed to delete annotation");
    }
  };

  const handleUpdateColor = async (
    annotationId: Id<"annotations">,
    color: AnnotationColor,
    from: number,
    to: number
  ) => {
    try {
      await updateAnnotation({ annotationId, color });

      // Also update the highlight color in the editor
      if (editor && editor.view) {
        try {
          editor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .setAnnotation({ annotationId, color })
            .run();
        } catch {
          // Editor view not ready, skip editor update
        }
      }
    } catch {
      toast.error("Failed to update color");
    }
  };

  const handleStartEdit = (annotationId: string, content: string) => {
    setEditingId(annotationId);
    setEditContent(content);
  };

  const handleSaveEdit = async (annotationId: Id<"annotations">) => {
    try {
      await updateAnnotation({ annotationId, content: editContent });
      setEditingId(null);
      setEditContent("");
    } catch {
      toast.error("Failed to update annotation");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleAnnotationClick = (annotationId: string, from: number, to: number) => {
    setSelectedAnnotationId(annotationId);

    // Scroll to the annotation in the editor
    if (editor && editor.view) {
      try {
        // Re-derive the position from the mark itself: only the mark moves with
        // the text when the document is edited, so the stored from/to are a
        // fallback, not the truth.
        //
        // This previously walked the doc inline, taking the FIRST match as the
        // start and the LAST as the end — for an annotation broken into two
        // fragments that selected everything in between, including unrelated
        // text. findAnnotationRange reports the fragments separately instead.
        const found = findAnnotationRange(editor.state.doc, annotationId);

        const selectionFrom =
          found.status === "single"
            ? found.from
            : found.status === "split"
              ? found.runs[0].from
              : from;
        const selectionTo =
          found.status === "single"
            ? found.to
            : found.status === "split"
              ? found.runs[0].to
              : to;

        // Select the full range of the annotation
        editor
          .chain()
          .focus()
          .setTextSelection({ from: selectionFrom, to: selectionTo })
          .run();

        // Custom scroll to center the annotation in the viewport
        setTimeout(() => {
          try {
            const { view } = editor;
            const { state } = view;
            const selection = state.selection;
            
            // Get the DOM coordinates of the selection
            const start = view.coordsAtPos(selection.from);
            const end = view.coordsAtPos(selection.to);
            
            // Calculate the center point of the selection
            const selectionCenterY = (start.top + end.top) / 2;
            
            // Find the scrollable container - look for overflow-auto or check parent elements
            let scrollContainer: HTMLElement | null = null;
            let current: HTMLElement | null = view.dom.parentElement;
            
            while (current) {
              const style = window.getComputedStyle(current);
              if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
                  current.classList.contains('overflow-auto') || 
                  current.classList.contains('overflow-y-auto')) {
                scrollContainer = current;
                break;
              }
              current = current.parentElement;
            }
            
            if (!scrollContainer) {
              // Fallback to window scroll
              const viewportHeight = window.innerHeight;
              const scrollY = window.scrollY + selectionCenterY - (viewportHeight / 2);
              window.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' });
              return;
            }
            
            // Get viewport dimensions
            const containerRect = scrollContainer.getBoundingClientRect();
            const viewportHeight = containerRect.height;
            const containerScrollTop = scrollContainer.scrollTop;
            
            // Calculate the position of the selection relative to the container
            // selectionCenterY is relative to viewport, so we need to add scrollTop
            const selectionRelativeY = selectionCenterY - containerRect.top + containerScrollTop;
            
            // Calculate scroll position to center the selection
            const targetScrollTop = selectionRelativeY - (viewportHeight / 2);
            
            // Scroll to center the selection
            scrollContainer.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
          } catch (error) {
            console.error("Failed to center annotation:", error);
            // Fallback to default scrollIntoView
            editor.commands.scrollIntoView();
          }
        }, 50); // Small delay to ensure DOM is updated
      } catch (error) {
        console.error("Failed to scroll to annotation:", error);
        // If the above fails, try a simpler approach with just the from position
        try {
          editor
            .chain()
            .focus()
            .setTextSelection(from)
            .run();
          
          // Center the selection
          setTimeout(() => {
            try {
              const { view } = editor;
              const coords = view.coordsAtPos(from);
              
              // Find the scrollable container
              let scrollContainer: HTMLElement | null = null;
              let current: HTMLElement | null = view.dom.parentElement;
              
              while (current) {
                const style = window.getComputedStyle(current);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
                    current.classList.contains('overflow-auto') || 
                    current.classList.contains('overflow-y-auto')) {
                  scrollContainer = current;
                  break;
                }
                current = current.parentElement;
              }
              
              if (scrollContainer) {
                const containerRect = scrollContainer.getBoundingClientRect();
                const viewportHeight = containerRect.height;
                const containerScrollTop = scrollContainer.scrollTop;
                const selectionRelativeY = coords.top - containerRect.top + containerScrollTop;
                const targetScrollTop = selectionRelativeY - (viewportHeight / 2);
                
                scrollContainer.scrollTo({
                  top: Math.max(0, targetScrollTop),
                  behavior: 'smooth'
                });
              } else {
                const viewportHeight = window.innerHeight;
                const scrollY = window.scrollY + coords.top - (viewportHeight / 2);
                window.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' });
              }
            } catch {
              editor.commands.scrollIntoView();
            }
          }, 50);
        } catch {
          // Editor view not ready, skip scrolling
        }
      }
    }
  };

  if (!isOpen) return null;

  const unresolvedAnnotations =
    annotations?.filter((a) => !a.resolved) || [];
  const resolvedAnnotations = annotations?.filter((a) => a.resolved) || [];

  // "Apply all" acts on the newest AI run only (see selectNewestBatchTargets).
  const applyAllTargets: ApplicableAnnotation[] = selectNewestBatchTargets(
    unresolvedAnnotations
  ).map((a) => ({
    _id: a._id,
    selectedText: a.selectedText,
    suggestedText: a.suggestedText,
    anchored: a.anchored,
  }));

  return (
    <div className="flex w-80 flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <Highlighter className="h-4 w-4" />
          <span className="font-medium">Annotations</span>
          {annotations && annotations.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({unresolvedAnnotations.length})
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Instructions */}
      <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Select text in the editor and click the highlight button to add an
        annotation.
      </div>

      {/* Apply all — only when the newest AI run has anchored, applicable rows */}
      {onApplyAll && applyAllTargets.length > 0 && (
        <div className="border-b p-2">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => onApplyAll(applyAllTargets)}
          >
            <Sparkles className="h-4 w-4" />
            Apply all ({applyAllTargets.length})
          </Button>
        </div>
      )}

      {/* Annotations List */}
      <div className="flex-1 overflow-y-auto p-3">
        {annotations === undefined ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : unresolvedAnnotations.length === 0 &&
          resolvedAnnotations.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <Highlighter className="mb-2 h-8 w-8" />
            <p className="text-sm">No annotations yet</p>
            <p className="text-xs">Select text to add one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Unresolved Annotations */}
            {unresolvedAnnotations.map((annotation) => (
              <AnnotationCard
                key={annotation._id}
                annotation={annotation}
                isSelected={selectedAnnotationId === annotation._id}
                isEditing={editingId === annotation._id}
                editContent={editContent}
                onEditContentChange={setEditContent}
                onClick={() =>
                  handleAnnotationClick(annotation._id, annotation.from, annotation.to)
                }
                onStartEdit={() =>
                  handleStartEdit(annotation._id, annotation.content)
                }
                onSaveEdit={() => handleSaveEdit(annotation._id)}
                onCancelEdit={handleCancelEdit}
                onToggleResolve={() => handleToggleResolve(annotation._id)}
                onDelete={() => handleDelete(annotation._id)}
                onUpdateColor={(color) =>
                  handleUpdateColor(annotation._id, color, annotation.from, annotation.to)
                }
                onApply={
                  onApplyOne
                    ? () =>
                        onApplyOne({
                          _id: annotation._id,
                          selectedText: annotation.selectedText,
                          suggestedText: annotation.suggestedText,
                          anchored: annotation.anchored,
                        })
                    : undefined
                }
              />
            ))}

            {/* Resolved Annotations Section */}
            {resolvedAnnotations.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setShowResolved(!showResolved)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                >
                  <span>
                    Resolved ({resolvedAnnotations.length})
                  </span>
                  {showResolved ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {showResolved && (
                  <div className="mt-2 space-y-3">
                    {resolvedAnnotations.map((annotation) => (
                      <AnnotationCard
                        key={annotation._id}
                        annotation={annotation}
                        isSelected={selectedAnnotationId === annotation._id}
                        isEditing={editingId === annotation._id}
                        editContent={editContent}
                        onEditContentChange={setEditContent}
                        onClick={() =>
                          handleAnnotationClick(annotation._id, annotation.from, annotation.to)
                        }
                        onStartEdit={() =>
                          handleStartEdit(annotation._id, annotation.content)
                        }
                        onSaveEdit={() => handleSaveEdit(annotation._id)}
                        onCancelEdit={handleCancelEdit}
                        onToggleResolve={() =>
                          handleToggleResolve(annotation._id)
                        }
                        onDelete={() => handleDelete(annotation._id)}
                        onUpdateColor={(color) =>
                          handleUpdateColor(annotation._id, color, annotation.from, annotation.to)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to get display name
function getDisplayName(
  fullName: string | undefined | null,
  email: string | undefined | null
): string {
  // If name exists and is not "Anonymous", use it
  if (fullName && fullName.trim() && fullName !== "Anonymous") {
    const firstName = fullName.split(" ")[0];
    return firstName || fullName;
  }
  
  // Fallback to email if available
  if (email && email.trim()) {
    const emailLocal = email.split("@")[0];
    return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
  }
  
  // Last resort
  return "You";
}

interface AnnotationCardProps {
  annotation: {
    _id: Id<"annotations">;
    content: string;
    selectedText: string;
    color: string;
    resolved: boolean;
    createdAt: number;
    from: number;
    to: number;
    // AI-authored rows carry these; user rows read them as undefined.
    authorType?: "user" | "ai";
    suggestedText?: string;
    anchored?: boolean;
    severity?: "low" | "medium" | "high";
    suggestionType?: string;
    user: {
      name: string;
      avatar?: string;
      email: string;
    } | null;
  };
  isSelected: boolean;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onClick: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleResolve: () => void;
  onDelete: () => void;
  onUpdateColor: (color: AnnotationColor) => void;
  /** Present for AI rows only; applies this suggestion to the document. */
  onApply?: () => void;
}

const SEVERITY_CLASSES: Record<string, string> = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  low: "bg-muted text-muted-foreground",
};

function AnnotationCard({
  annotation,
  isSelected,
  isEditing,
  editContent,
  onEditContentChange,
  onClick,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleResolve,
  onDelete,
  onUpdateColor,
  onApply,
}: AnnotationCardProps) {
  const colorInfo = annotationColors.find((c) => c.id === annotation.color);
  // Rule 6 of the grammar prompt lets the model skip a verbatim quote; those
  // rows arrive anchored:false and are a normal outcome, not a failure.
  const { isAI, isUnanchored, canApply } = suggestionEligibility(annotation);

  return (
    <div
      className={`cursor-pointer rounded-lg border p-3 transition-all ${
        annotation.resolved ? "bg-muted/50" : "bg-background"
      } ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      {/* Highlighted Text Preview — skipped for unanchored AI rows, which
          have no span in the document to quote. */}
      {!isUnanchored && (
        <div
          className={
            isAI
              ? "mb-2 rounded border-l-2 border-primary bg-muted/50 px-2 py-1 text-xs"
              : `mb-2 rounded px-2 py-1 text-xs ${colorInfo?.bgClass || "bg-yellow-200/60"}`
          }
        >
          <span className="line-clamp-2 italic">
            &ldquo;{annotation.selectedText}&rdquo;
          </span>
        </div>
      )}

      {isAI ? (
        /* AI provenance + classification — replaces the colour swatch row,
           which is meaningless for a marker the user can't recolour. */
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            AI
          </span>
          {annotation.suggestionType && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
              {annotation.suggestionType}
            </span>
          )}
          {annotation.severity && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                SEVERITY_CLASSES[annotation.severity] ?? SEVERITY_CLASSES.low
              }`}
            >
              {annotation.severity}
            </span>
          )}
        </div>
      ) : (
        /* Color Selector */
        <div className="mb-2 flex gap-1">
          {annotationColors.map((color) => (
            <button
              key={color.id}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateColor(color.id);
              }}
              className={`h-4 w-4 rounded-full border-2 transition-transform hover:scale-110 ${
                annotation.color === color.id
                  ? "border-foreground"
                  : "border-transparent"
              } ${color.bgClass}`}
              title={color.name}
            />
          ))}
        </div>
      )}

      {/* User & Time */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="text-sm font-medium">
            {isAI
              ? "AI suggestion"
              : getDisplayName(annotation.user?.name, annotation.user?.email)}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(annotation.createdAt)}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onToggleResolve();
            }}
            title={
              annotation.resolved
                ? "Unresolve"
                : isAI
                  ? "Dismiss"
                  : "Resolve"
            }
          >
            <Check
              className={`h-3 w-3 ${
                annotation.resolved ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* AI message: read-only. The model's note is not a user note to edit. */}
      {isAI ? (
        <>
          {annotation.content && (
            <p className="text-sm text-muted-foreground">{annotation.content}</p>
          )}

          {isUnanchored && (
            <div className="mt-2 flex items-start gap-1.5 rounded bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
              <MapPinOff className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Couldn&apos;t be located in the document — review and apply this
                one manually.
              </span>
            </div>
          )}

          {canApply && annotation.suggestedText && (
            <div className="mt-2 space-y-1.5">
              <div className="rounded border border-primary/40 bg-primary/5 px-2 py-1 text-xs">
                <span className="line-clamp-2">→ {annotation.suggestedText}</span>
              </div>
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply?.();
                }}
              >
                <Check className="h-3.5 w-3.5" />
                Apply
              </Button>
            </div>
          )}
        </>
      ) : /* Note Content */
      isEditing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            className="min-h-[60px] text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p
          className={`text-sm ${
            annotation.resolved ? "text-muted-foreground line-through" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
        >
          {annotation.content || (
            <span className="italic text-muted-foreground">
              Click to add a note...
            </span>
          )}
        </p>
      )}

      {annotation.resolved && (
        <div className="mt-2 text-xs text-muted-foreground">Resolved</div>
      )}
    </div>
  );
}
