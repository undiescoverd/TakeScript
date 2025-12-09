"use client";

import { Editor } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Highlighter,
  Sparkles,
  Maximize2,
  RefreshCw,
  FileText,
  MessageSquare,
  X,
  Hash,
  ScreenShare,
  Presentation,
  StickyNote,
  ChevronDown,
  UserCircle,
  Plus,
} from "lucide-react";
import { getFeatureFlags } from "@/lib/feature-flags";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useEditorStore } from "@/store/editor-store";
import {
  annotationColors,
  AnnotationColor,
} from "@/lib/tiptap/annotation-mark";
import { generateBlockId } from "@/lib/utils";
import { useSpeakerStore } from "@/store/speaker-store";
import { AddSpeakerDialog } from "./AddSpeakerDialog";

interface SelectionToolbarProps {
  editor: Editor;
  scriptId: Id<"scripts">;
}

// Highlight color options
const highlightColors = [
  { id: "default", name: "Default Color", class: "bg-yellow-200 dark:bg-yellow-800" },
  { id: "red", name: "Red", class: "bg-red-200 dark:bg-red-800" },
  { id: "orange", name: "Orange", class: "bg-orange-200 dark:bg-orange-800" },
  { id: "yellow", name: "Yellow", class: "bg-yellow-200 dark:bg-yellow-800" },
  { id: "green", name: "Green", class: "bg-green-200 dark:bg-green-800" },
  { id: "teal", name: "Teal", class: "bg-teal-200 dark:bg-teal-800" },
  { id: "blue", name: "Blue", class: "bg-blue-200 dark:bg-blue-800" },
  { id: "purple", name: "Purple", class: "bg-purple-200 dark:bg-purple-800" },
  { id: "grey", name: "Grey", class: "bg-gray-200 dark:bg-gray-800" },
];

export function SelectionToolbar({ editor, scriptId }: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [selectedColor, setSelectedColor] = useState<AnnotationColor>("yellow");
  const [selectionData, setSelectionData] = useState<{
    from: number;
    to: number;
    text: string;
  } | null>(null);
  const isSelectingRef = useRef(false);
  const [isAddSpeakerOpen, setIsAddSpeakerOpen] = useState(false);
  const [isSpeakerMenuOpen, setIsSpeakerMenuOpen] = useState(false);

  const flags = getFeatureFlags();
  const createAnnotation = useMutation(api.annotations.create);
  const { setAnnotationsOpen } = useEditorStore();
  const speakers = useSpeakerStore((state) => state.speakers);

  useEffect(() => {
    const updateToolbar = () => {
      // Don't update if annotation popover is open, speaker menu is open, or user is actively selecting
      if (isAnnotationOpen || isSpeakerMenuOpen || isSelectingRef.current) return;

      const { selection } = editor.state;
      const { from, to } = selection;

      // Hide if no selection or cursor only
      if (from === to) {
        setIsVisible(false);
        setSelectionData(null);
        return;
      }

      // Get the DOM position of the selection
      const { view } = editor;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);

      if (!start || !end) {
        setIsVisible(false);
        return;
      }

      // Store selection data
      const selectedText = editor.state.doc.textBetween(from, to);
      setSelectionData({ from, to, text: selectedText });

      // Calculate toolbar position (above selection, centered)
      const toolbarWidth = 600; // Approximate width
      const toolbarHeight = 48; // Approximate height

      const left = (start.left + end.left) / 2 - toolbarWidth / 2;
      const top = start.top - toolbarHeight - 8; // 8px gap above selection

      setPosition({ top, left });
      setIsVisible(true);
    };

    // Track when user starts selecting (mousedown)
    const handleMouseDown = (e: MouseEvent) => {
      // Only track if mousedown is in the editor
      if ((e.target as HTMLElement).closest(".ProseMirror")) {
        isSelectingRef.current = true;
        setIsVisible(false);
      }
    };

    // Track when user finishes selecting (mouseup)
    const handleMouseUp = () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        // Small delay to let selection settle
        setTimeout(updateToolbar, 50);
      }
    };

    // Update on selection change (only when not actively selecting)
    const handleSelectionUpdate = () => {
      if (!isSelectingRef.current) {
        updateToolbar();
      }
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    editor.on("update", handleSelectionUpdate);

    // Listen for mouse events globally
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
      editor.off("update", handleSelectionUpdate);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [editor, isAnnotationOpen, isSpeakerMenuOpen]);

  // Reset annotation state when popover closes
  useEffect(() => {
    if (!isAnnotationOpen) {
      setNoteContent("");
      setSelectedColor("yellow");
    }
  }, [isAnnotationOpen]);

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

      setIsAnnotationOpen(false);
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
    const { from } = editor.state.selection;
    const resolvedPos = editor.state.doc.resolve(from);
    const marks = resolvedPos.marks();
    const annotationMark = marks.find((mark) => mark.type.name === "annotation");
    const annotationId = annotationMark?.attrs.annotationId;

    if (!annotationId) {
      toast.error("No annotation found");
      return;
    }

    setIsVisible(false);
    setSelectionData(null);
    editor.commands.removeAnnotation(annotationId);
    editor.commands.setTextSelection(from);
    toast.success("Annotation removed");
  }, [editor]);

  const handleAICommand = (command: string) => {
    const selectedText = selectionData?.text || "";
    const { from, to } = editor.state.selection;

    // Dispatch AI event with selection context
    window.dispatchEvent(
      new CustomEvent(`ai:${command}`, {
        detail: {
          editor,
          selectedText,
          selection: { from, to, text: selectedText, isEmpty: false },
        },
      })
    );
  };

  const handleHighlightColor = (colorId: string) => {
    if (colorId === "default") {
      editor.chain().focus().toggleHighlight().run();
    } else {
      editor.chain().focus().toggleHighlight({ color: colorId }).run();
    }
  };

  const insertChapter = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    // Use selected text as chapter title if available, otherwise default
    const chapterTitle = selectedText.trim() || "New Chapter";

    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: "chapter",
        attrs: {
          title: chapterTitle,
          id: generateBlockId("chapter"),
        },
      })
      .run();
  };

  const insertScreenRecording = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    // Use selected text as content if available, otherwise default
    const content = selectedText.trim() || "Describe screen recording...";

    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: "screenRecording",
        attrs: { id: generateBlockId("screenRecording") },
        content: [{ type: "text", text: content }],
      })
      .run();
  };

  const insertDemonstration = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    // Use selected text as content if available, otherwise default
    const content = selectedText.trim() || "Describe demonstration...";

    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: "demonstration",
        attrs: { id: generateBlockId("demonstration") },
        content: [{ type: "text", text: content }],
      })
      .run();
  };

  const insertEditorNote = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    // Use selected text as content if available, otherwise default
    const content = selectedText.trim() || "Editor note...";

    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: "editorNote",
        attrs: { id: generateBlockId("editorNote") },
        content: [{ type: "text", text: content }],
      })
      .run();
  };

  const handleSpeakerClick = (speakerId: string) => {
    // Get current selection directly from editor state
    const { from, to } = editor.state.selection;

    if (from === to) {
      toast.error("Please select some text first");
      return;
    }

    // Apply speaker directly - no dialog needed
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .setSpeaker(speakerId)
      .run();

    setIsVisible(false);
    setSelectionData(null);
    setIsSpeakerMenuOpen(false);
    toast.success("Speaker assigned");
  };

  const handleRemoveSpeaker = () => {
    editor.chain().focus().unsetSpeaker().run();
    setIsVisible(false);
    setSelectionData(null);
    toast.success("Speaker removed");
  };

  const handleSpeakerCreated = (speakerId: string) => {
    handleSpeakerClick(speakerId);
  };

  if (!isVisible) return null;

  const hasAnnotation = editor.isActive("annotation");

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-lg"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Text Formatting */}
      <ToolbarButton
        icon={<Bold className="h-4 w-4" />}
        tooltip="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
      />
      <ToolbarButton
        icon={<Italic className="h-4 w-4" />}
        tooltip="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
      />
      <ToolbarButton
        icon={<Underline className="h-4 w-4" />}
        tooltip="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
      />
      <ToolbarButton
        icon={<Strikethrough className="h-4 w-4" />}
        tooltip="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
      />

      {/* Highlight with Color Picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`rounded p-1.5 transition-colors hover:bg-accent flex items-center gap-0.5 ${
              editor.isActive("highlight") ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            }`}
            title="Highlight"
          >
            <Highlighter className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Highlight Color</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {highlightColors.map((color) => (
            <DropdownMenuItem
              key={color.id}
              onClick={() => handleHighlightColor(color.id)}
              className="flex items-center gap-2"
            >
              <div className={`h-4 w-4 rounded ${color.class} border`} />
              <span className="text-sm">{color.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Headings */}
      <ToolbarButton
        icon={<Heading1 className="h-4 w-4" />}
        tooltip="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
      />
      <ToolbarButton
        icon={<Heading2 className="h-4 w-4" />}
        tooltip="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
      />
      <ToolbarButton
        icon={<Heading3 className="h-4 w-4" />}
        tooltip="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
      />

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Lists & Blocks */}
      <ToolbarButton
        icon={<List className="h-4 w-4" />}
        tooltip="Bullet List"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
      />
      <ToolbarButton
        icon={<ListOrdered className="h-4 w-4" />}
        tooltip="Numbered List"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
      />
      <ToolbarButton
        icon={<Quote className="h-4 w-4" />}
        tooltip="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
      />
      <ToolbarButton
        icon={<Code className="h-4 w-4" />}
        tooltip="Code"
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
      />

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Script Blocks */}
      <ToolbarButton
        icon={<Hash className="h-4 w-4" />}
        tooltip="Chapter"
        onClick={insertChapter}
      />
      <ToolbarButton
        icon={<ScreenShare className="h-4 w-4" />}
        tooltip="Screen Recording"
        onClick={insertScreenRecording}
      />
      <ToolbarButton
        icon={<Presentation className="h-4 w-4" />}
        tooltip="Demonstration"
        onClick={insertDemonstration}
      />
      <ToolbarButton
        icon={<StickyNote className="h-4 w-4" />}
        tooltip="Editor Note"
        onClick={insertEditorNote}
      />

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Speaker Assignment */}
      <DropdownMenu open={isSpeakerMenuOpen} onOpenChange={setIsSpeakerMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent flex items-center gap-1"
            title="Assign speaker"
          >
            <UserCircle className="h-4 w-4" />
            Speaker
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Assign Speaker</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {speakers.length > 0 ? (
            speakers.map((speaker) => (
              <DropdownMenuItem
                key={speaker.id}
                onClick={() => handleSpeakerClick(speaker.id)}
                className="flex items-center gap-2"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: speaker.color }}
                />
                <span>{speaker.name}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No speakers yet
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setIsSpeakerMenuOpen(false);
              setIsAddSpeakerOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Speaker</span>
          </DropdownMenuItem>
          {editor.isActive("speaker") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setIsSpeakerMenuOpen(false);
                  handleRemoveSpeaker();
                }}
                className="flex items-center gap-2 text-destructive"
              >
                <X className="h-4 w-4" />
                <span>Remove Speaker</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 h-6 w-px bg-border" />

      {/* Annotation */}
      {hasAnnotation ? (
        <button
          type="button"
          onClick={handleRemoveAnnotation}
          className="rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
          title="Remove annotation"
        >
          <X className="mr-1 inline-block h-4 w-4" />
          Remove Note
        </button>
      ) : (
        <Popover open={isAnnotationOpen} onOpenChange={setIsAnnotationOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
              title="Add annotation"
            >
              <MessageSquare className="mr-1 inline-block h-4 w-4" />
              Add Note
            </button>
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
                  onClick={() => setIsAnnotationOpen(false)}
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

      {/* AI Commands */}
      {flags.aiGenerationEnabled && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />

          <ToolbarButton
            icon={<Sparkles className="h-4 w-4" />}
            tooltip="AI Generate"
            onClick={() => handleAICommand("generate")}
          />
          <ToolbarButton
            icon={<Maximize2 className="h-4 w-4" />}
            tooltip="AI Expand"
            onClick={() => handleAICommand("expand")}
          />
          <ToolbarButton
            icon={<RefreshCw className="h-4 w-4" />}
            tooltip="AI Rephrase"
            onClick={() => handleAICommand("rephrase")}
          />
          <ToolbarButton
            icon={<FileText className="h-4 w-4" />}
            tooltip="AI Summarize"
            onClick={() => handleAICommand("summarize")}
          />
        </>
      )}

      {/* Add Speaker Dialog */}
      <AddSpeakerDialog
        open={isAddSpeakerOpen}
        onOpenChange={setIsAddSpeakerOpen}
        onSpeakerCreated={handleSpeakerCreated}
      />
    </div>
  );
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  isActive?: boolean;
}

function ToolbarButton({ icon, tooltip, onClick, isActive }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded p-1.5 transition-colors hover:bg-accent ${
        isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      }`}
      title={tooltip}
    >
      {icon}
    </button>
  );
}
