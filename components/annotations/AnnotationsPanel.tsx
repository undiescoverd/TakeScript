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
} from "lucide-react";
import { formatDistanceToNow } from "@/lib/utils";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor-store";
import { annotationColors, AnnotationColor } from "@/lib/tiptap/annotation-mark";
import { Editor } from "@tiptap/react";

interface AnnotationsPanelProps {
  scriptId: Id<"scripts">;
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
}

export function AnnotationsPanel({
  scriptId,
  isOpen,
  onClose,
  editor,
}: AnnotationsPanelProps) {
  // Only subscribe to query when panel is open - saves bandwidth
  const annotations = useQuery(api.annotations.list, isOpen ? { scriptId } : "skip");
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
        const { state } = editor;
        let foundFrom: number | null = null;
        let foundTo: number | null = null;

        // Search through the document for the annotation mark by ID
        // This finds the actual current position, even if the document has changed
        state.doc.descendants((node, pos) => {
          if (node.isText && node.marks) {
            const annotationMark = node.marks.find(
              (mark) => mark.type.name === "annotation" && mark.attrs.annotationId === annotationId
            );
            
            if (annotationMark) {
              // Found a text node with this annotation
              // Track the start and end of the annotation range
              if (foundFrom === null) {
                foundFrom = pos;
              }
              foundTo = pos + node.nodeSize;
            }
          }
        });

        // If we found the annotation in the document, use those positions
        // Otherwise, fall back to the stored positions from the database
        const selectionFrom = foundFrom !== null ? foundFrom : from;
        const selectionTo = foundTo !== null ? foundTo : to;

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
}

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
}: AnnotationCardProps) {
  const colorInfo = annotationColors.find((c) => c.id === annotation.color);

  return (
    <div
      className={`cursor-pointer rounded-lg border p-3 transition-all ${
        annotation.resolved ? "bg-muted/50" : "bg-background"
      } ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      {/* Highlighted Text Preview */}
      <div
        className={`mb-2 rounded px-2 py-1 text-xs ${colorInfo?.bgClass || "bg-yellow-200/60"}`}
      >
        <span className="line-clamp-2 italic">
          &ldquo;{annotation.selectedText}&rdquo;
        </span>
      </div>

      {/* Color Selector */}
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

      {/* User & Time */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="text-sm font-medium">
            {getDisplayName(annotation.user?.name, annotation.user?.email)}
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
            title={annotation.resolved ? "Unresolve" : "Resolve"}
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

      {/* Note Content */}
      {isEditing ? (
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
