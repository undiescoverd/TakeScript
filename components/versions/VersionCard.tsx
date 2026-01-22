"use client";

import { Id } from "@/convex/_generated/dataModel";
import { formatDistanceToNow, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, RotateCcw } from "lucide-react";

interface VersionListItem {
  _id: Id<"scriptVersions">;
  versionNumber: number;
  createdAt: number;
  changeNote?: string;
}

interface VersionCardProps {
  version: VersionListItem;
  onView: () => void;
  onRestore: () => void;
}

export function VersionCard({ version, onView, onRestore }: VersionCardProps) {
  return (
    <div className="rounded-lg border bg-background p-3 transition-colors hover:border-primary">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">v{version.versionNumber}</span>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(version.createdAt)}
        </span>
      </div>

      {version.changeNote && (
        <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
          {version.changeNote}
        </p>
      )}

      <div className="mb-2 text-xs text-muted-foreground">
        {formatDate(version.createdAt)}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onView}>
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
        <Button variant="outline" size="sm" onClick={onRestore}>
          <RotateCcw className="mr-1 h-3 w-3" />
          Restore
        </Button>
      </div>
    </div>
  );
}
