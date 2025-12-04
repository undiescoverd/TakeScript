"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Highlighter, X } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor-store";
import {
  annotationColors,
  AnnotationColor,
} from "@/lib/tiptap/annotation-mark";

interface AnnotationBubbleProps {
  editor: Editor;
  scriptId: Id<"scripts">;
}

export function AnnotationBubble({ editor, scriptId }: AnnotationBubbleProps) {
  const createAnnotation = useMutation(api.annotations.create);
  const { setAnnotationsOpen } = useEditorStore();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>("yellow");
  const [selectionData, setSelectionData] = useState<{
    from: number;
    to: number;
    text: string;
  } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const isHidingRef = useRef(false);
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  // Track selection changes
  useEffect(() => {
    const updatePosition = () => {
      // Don't update if user is interacting with the bubble or if we're hiding
      if (isInteractingRef.current || isPopoverOpen || isHidingRef.current) return;

      const { selection } = editor.state;
      const { from, to } = selection;

      // Skip if selection hasn't changed
      if (
        lastSelectionRef.current &&
        lastSelectionRef.current.from === from &&
        lastSelectionRef.current.to === to
      ) {
        return;
      }

      lastSelectionRef.current = { from, to };

      // Check if there's a text selection
      if (from === to || selection.empty) {
        setIsVisible(false);
        setSelectionData(null);
        lastSelectionRef.current = null;
        return;
      }

      // Batch DOM reads in requestAnimationFrame to avoid layout thrashing
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        // Get the selection coordinates
        const view = editor.view;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);

        // Position the bubble above the selection
        const editorElement = view.dom.parentElement;
        if (!editorElement) return;

        const editorRect = editorElement.getBoundingClientRect();

        // Calculate center position
        const left = (start.left + end.left) / 2 - editorRect.left;
        const top = start.top - editorRect.top - 50; // 50px above selection

        // Store selection data for later use
        const selectedText = editor.state.doc.textBetween(from, to, " ");
        setSelectionData({ from, to, text: selectedText });

        setPosition({ top: Math.max(10, top), left });
        setIsVisible(true);
      });
    };

    // Only listen to selectionUpdate - transaction listener was causing performance issues
    editor.on("selectionUpdate", updatePosition);

    return () => {
      editor.off("selectionUpdate", updatePosition);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [editor, isPopoverOpen]);

  // Handle mouse interactions on the bubble
  const handleMouseDown = useCallback(() => {
    isInteractingRef.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    // Keep interacting flag true for a bit to prevent immediate hiding
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 300);
  }, []);

  // Reset state when popover closes
  useEffect(() => {
    if (!isPopoverOpen) {
      setNoteContent("");
      setSelectedColor("yellow");
    }
  }, [isPopoverOpen]);

  const handleAddAnnotation = useCallback(async () => {
    if (!selectionData || !selectionData.text.trim()) {
      toast.error("Please select some text first");
      return;
    }

    const { from, to, text } = selectionData;

    try {
      // Create annotation in database
      const annotationId = await createAnnotation({
        scriptId,
        content: noteContent,
        selectedText: text.trim(),
        from,
        to,
        color: selectedColor,
      });

      // Re-select the text and apply the annotation mark
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setAnnotation({
          annotationId: annotationId,
          color: selectedColor,
        })
        .run();

      setIsPopoverOpen(false);
      setIsVisible(false);
      setNoteContent("");
      setSelectionData(null);
      setAnnotationsOpen(true);
      toast.success("Annotation added");
    } catch (error) {
      console.error("Failed to add annotation:", error);
      toast.error("Failed to add annotation");
    }
  }, [
    editor,
    scriptId,
    noteContent,
    selectedColor,
    selectionData,
    createAnnotation,
    setAnnotationsOpen,
  ]);

  const handleRemoveAnnotation = useCallback(() => {
    // Get the annotation ID from the current selection BEFORE any state changes
    const { from } = editor.state.selection;
    const resolvedPos = editor.state.doc.resolve(from);
    const marks = resolvedPos.marks();
    const annotationMark = marks.find((mark) => mark.type.name === "annotation");
    const annotationId = annotationMark?.attrs.annotationId;

    if (!annotationId) {
      toast.error("No annotation found");
      return;
    }

    // Prevent the selection listener from re-showing the bubble
    isHidingRef.current = true;
    lastSelectionRef.current = null;
    setIsVisible(false);
    setSelectionData(null);

    // Remove the annotation by ID (removes from entire document)
    editor.commands.removeAnnotation(annotationId);

    // Collapse selection to prevent bubble from reappearing
    editor.commands.setTextSelection(from);

    toast.success("Annotation removed");

    // Reset the flag after a short delay
    setTimeout(() => {
      isHidingRef.current = false;
    }, 150);
  }, [editor]);

  // Check if current selection already has an annotation
  const hasAnnotation = editor.isActive("annotation");

  if (!isVisible) return null;

  return (
    <div
      ref={bubbleRef}
      className="absolute z-50 flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {hasAnnotation ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-sm"
          onClick={handleRemoveAnnotation}
        >
          <X className="mr-1 h-4 w-4" />
          Remove
        </Button>
      ) : (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-sm">
              <Highlighter className="mr-1 h-4 w-4" />
              Add Note
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80"
            align="center"
            side="top"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="space-y-3">
              <div className="font-medium">Add Annotation</div>

              {/* Selected text preview */}
              {selectionData && (
                <div className="rounded bg-muted p-2 text-xs text-muted-foreground">
                  <span className="line-clamp-2 italic">
                    &ldquo;{selectionData.text}&rdquo;
                  </span>
                </div>
              )}

              {/* Color Selection */}
              <div className="flex gap-2">
                {annotationColors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setSelectedColor(color.id)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color.id
                        ? "border-foreground"
                        : "border-transparent"
                    } ${color.bgClass}`}
                    title={color.name}
                  />
                ))}
              </div>

              {/* Note Input */}
              <Textarea
                placeholder="Add a note (optional)..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="min-h-[80px] resize-none"
              />

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setIsPopoverOpen(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" type="button" onClick={handleAddAnnotation}>
                  Add Annotation
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
