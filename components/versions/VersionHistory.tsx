"use client";

import { useQuery, useAction } from "convex/react";
import { useState } from "react";
import { JSONContent } from "@tiptap/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";
import { VersionCard } from "./VersionCard";
import { VersionPreview } from "./VersionPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, History } from "lucide-react";
import { toast } from "sonner";

interface Version {
  _id: Id<"scriptVersions">;
  _creationTime: number;
  scriptId: Id<"scripts">;
  versionNumber: number;
  content: string;
  contentUrl?: string;
  contentSize?: number;
  changedBy: Id<"users">;
  changeNote?: string;
  createdAt: number;
}

interface VersionHistoryProps {
  scriptId: Id<"scripts">;
}

export function VersionHistory({ scriptId }: VersionHistoryProps) {
  const { versionHistoryOpen, setVersionHistoryOpen } = useEditorStore();
  // Only subscribe to query when panel is open - saves bandwidth
  const versions = useQuery(api.versions.list, versionHistoryOpen ? { scriptId } : "skip");
  const restoreVersion = useAction(api.versions.restore);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const [viewingContent, setViewingContent] = useState<string>("");

  const handleView = (content: string) => {
    setViewingContent(content);
    setViewingVersion("viewing");
  };

  const handleRestore = async (versionId: Id<"scriptVersions">) => {
    try {
      await restoreVersion({ versionId });
      toast.success("Version restored");
    } catch {
      toast.error("Failed to restore version");
    }
  };

  if (!versionHistoryOpen) {
    return null;
  }

  return (
    <>
      <div className="flex w-80 flex-col border-l bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="font-medium">Version History</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVersionHistoryOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {versions === undefined ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <History className="mb-2 h-8 w-8" />
              <p className="text-sm">No versions yet</p>
              <p className="text-xs">Save a version to track changes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version: Version) => (
                <VersionCard
                  key={version._id}
                  version={version}
                  onView={() => handleView(version.content)}
                  onRestore={() => handleRestore(version._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Version Dialog */}
      <Dialog
        open={viewingVersion !== null}
        onOpenChange={() => setViewingVersion(null)}
      >
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version Preview</DialogTitle>
          </DialogHeader>
          {(() => {
            try {
              const content = JSON.parse(viewingContent) as JSONContent;
              return <VersionPreview content={content} />;
            } catch {
              return (
                <div className="rounded-lg border bg-destructive/10 p-4 text-destructive">
                  <p className="font-semibold">Error parsing version content</p>
                  <p className="mt-2 text-sm">
                    This version may be corrupted or in an invalid format.
                  </p>
                </div>
              );
            }
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
