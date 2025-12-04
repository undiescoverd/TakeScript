"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
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
} from "lucide-react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/collaboration/ShareDialog";

interface TopbarProps {
  scriptId: Id<"scripts">;
  title: string;
  content: JSONContent;
  onSaveNow: () => Promise<void>;
}

export function Topbar({ scriptId, title, content, onSaveNow }: TopbarProps) {
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const updateTitle = useMutation(api.scripts.updateTitle);
  const saveVersion = useMutation(api.versions.save);
  const { isSaving, toggleVersionHistory, toggleComments, toggleAnnotations, lastSavedAt, collaborationEnabled, toggleCollaboration } = useEditorStore();

  useEffect(() => {
    setTitleValue(title);
  }, [title]);

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

        {isSaving && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        <ModeToggle />
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <div className="mr-4 text-sm text-muted-foreground">
          {wordCount} words &middot; {readTime} min read
        </div>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>

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

        <ShareDialog scriptId={scriptId} />

        <Button
          variant={collaborationEnabled ? "default" : "ghost"}
          size="icon"
          onClick={toggleCollaboration}
          title={collaborationEnabled ? "Collaboration enabled" : "Enable collaboration"}
        >
          <Users className="h-4 w-4" />
        </Button>

        <ThemeToggle />
        <UserButton afterSignOutUrl="/login" />
      </div>
    </header>
  );
}
