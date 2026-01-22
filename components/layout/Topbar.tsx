"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useAction } from "convex/react";
import { UserButton } from "@clerk/nextjs";
import { JSONContent } from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";
import { getWordCount, getReadTime, exportToPlainText } from "@/lib/tiptap/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./ThemeToggle";
import { ModeToggle } from "@/components/editor/ModeToggle";
import {
  ArrowLeft,
  Save,
  History,
  Download,
  Loader2,
  MessageSquare,
  Highlighter,
  Users,
  UserRoundPlus,
  Check,
  Sparkles,
  CheckCircle,
  FileSearch,
  Layers,
  Circle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/collaboration/ShareDialog";
import { SaveTemplateDialog } from "@/components/templates/SaveTemplateDialog";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import { getFeatureFlags } from "@/lib/feature-flags";
import { KeyboardShortcutsDialog } from "@/components/editor/KeyboardShortcutsDialog";

interface TopbarProps {
  scriptId: Id<"scripts">;
  title: string;
  content: JSONContent;
  onSaveNow: () => Promise<void>;
  onOpenAIChat?: () => void;
  onGrammarCheck?: () => void;
  onScriptReview?: () => void;
}

export function Topbar({ scriptId, title, content, onSaveNow, onOpenAIChat, onGrammarCheck, onScriptReview }: TopbarProps) {
  const router = useRouter();
  const flags = getFeatureFlags();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [wasSaving, setWasSaving] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const updateTitle = useMutation(api.scripts.updateTitle);
  const saveVersion = useAction(api.versions.save);
  const { isSaving, toggleVersionHistory, toggleComments, toggleAnnotations, toggleSpeakers, speakersOpen, lastSavedAt, collaborationEnabled, toggleCollaboration, viewMode, setViewMode } = useEditorStore();
  const templatesSaveEnabled = useFeatureFlag("templatesSaveEnabled");

  useEffect(() => {
    setTitleValue(title);
  }, [title]);

  // Track previous saving state to detect transitions
  useEffect(() => {
    setWasSaving(isSaving);
  }, [isSaving]);

  // Show "All changes saved" message briefly when save completes (Google Docs style)
  // Only trigger when transitioning from saving to not saving
  useEffect(() => {
    if (wasSaving && !isSaving && lastSavedAt) {
      // Save just completed
      setShowSavedMessage(true);
      const timer = setTimeout(() => {
        setShowSavedMessage(false);
      }, 3000); // Hide after 3 seconds
      return () => clearTimeout(timer);
    } else if (isSaving) {
      // Currently saving - hide the saved message
      setShowSavedMessage(false);
    }
  }, [isSaving, lastSavedAt, wasSaving]);

  const wordCount = getWordCount(content);
  const readTime = getReadTime(content);

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== title) {
      try {
        await updateTitle({ scriptId, title: titleValue.trim() });
      } catch {
        toast.error("Failed to update title");
        setTitleValue(title);
      }
    } else {
      setTitleValue(title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setTitleValue(title);
      setEditingTitle(false);
    }
  };

  const handleSaveVersion = async () => {
    try {
      await onSaveNow();
      await saveVersion({ scriptId });
      toast.success("Version saved");
    } catch {
      toast.error("Failed to save version");
    }
  };

  const handleExport = useCallback(() => {
    const plainText = exportToPlainText(content);
    navigator.clipboard.writeText(plainText);
    toast.success("Copied to clipboard for PrompSmart!");
  }, [content]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveVersion();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        handleExport();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleExport]);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {editingTitle ? (
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="h-8 w-64"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="text-lg font-medium hover:text-muted-foreground"
          >
            {title}
          </button>
        )}

        {isSaving ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        ) : showSavedMessage ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground animate-in fade-in duration-200">
            <Check className="h-3 w-3 text-green-600" />
            All changes saved
          </div>
        ) : null}
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1">
          <Button
            variant={viewMode === "focus" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("focus")}
            disabled={collaborationEnabled}
            title={collaborationEnabled ? "Disable collaboration to use Focus Mode" : "Focus Mode - distraction-free writing"}
            className="gap-1.5 px-2.5 h-8"
          >
            <Circle className="h-3.5 w-3.5" />
            Focus
          </Button>
          <Button
            variant={viewMode === "edit" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("edit")}
            title="Edit Mode - full-featured interface"
            className="gap-1.5 px-2.5 h-8"
          >
            <Layers className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>

        <ModeToggle />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <div className="mr-4 text-sm text-muted-foreground">
          {wordCount} words &middot; {readTime} min read
        </div>

        {viewMode === "edit" && (
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            {templatesSaveEnabled && (
              <SaveTemplateDialog content={JSON.stringify(content)} />
            )}

            <Button variant="outline" size="sm" onClick={handleSaveVersion}>
              <Save className="mr-2 h-4 w-4" />
              Save Version
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleVersionHistory}>
              <History className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleComments}>
              <MessageSquare className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={toggleAnnotations} title="Annotations">
              <Highlighter className="h-4 w-4" />
            </Button>

            <Button
              variant={speakersOpen ? "default" : "ghost"}
              size="icon"
              onClick={toggleSpeakers}
              title="Speakers"
            >
              <UserRoundPlus className="h-4 w-4" />
            </Button>

            {flags.aiChatEnabled && onOpenAIChat && (
              <Button variant="ghost" size="icon" onClick={onOpenAIChat} title="AI Assistant">
                <Sparkles className="h-4 w-4" />
              </Button>
            )}

            {flags.aiGrammarCheckEnabled && onGrammarCheck && (
              <Button variant="ghost" size="icon" onClick={onGrammarCheck} title="Check Grammar & Style">
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}

            {flags.aiReviewEnabled && onScriptReview && (
              <Button variant="ghost" size="icon" onClick={onScriptReview} title="Review Script">
                <FileSearch className="h-4 w-4" />
              </Button>
            )}

            <ShareDialog scriptId={scriptId} />

            <Button
              variant={collaborationEnabled ? "default" : "ghost"}
              size="icon"
              onClick={toggleCollaboration}
              title={collaborationEnabled ? "Collaboration enabled" : "Enable collaboration"}
            >
              <Users className="h-4 w-4" />
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShortcutsDialogOpen(true)}
          title="Keyboard Shortcuts"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

        <ThemeToggle />
        <UserButton afterSignOutUrl="/login" />
      </div>

      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
    </header>
  );
}
