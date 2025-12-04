"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share2, Copy, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { Collaborators } from "./Collaborators";
import { useCollaboration } from "@/hooks/use-collaboration";
import { Id } from "@/convex/_generated/dataModel";
import { useEditorStore } from "@/store/editor-store";

interface ShareDialogProps {
  scriptId: Id<"scripts">;
}

export function ShareDialog({ scriptId }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const { collaborationEnabled } = useEditorStore();
  
  // Get collaboration data if enabled
  const collaboration = useCollaboration({
    documentId: scriptId,
    enabled: collaborationEnabled && open, // Only enable when dialog is open
  });

  // Build the full URL
  const scriptUrl = typeof window !== "undefined" 
    ? `${window.location.origin}${pathname}`
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Share script">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Script</DialogTitle>
          <DialogDescription>
            Share this link with others to collaborate on this script
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Script URL */}
          <div className="space-y-2">
            <Label htmlFor="script-url">Script Link</Label>
            <div className="flex gap-2">
              <Input
                id="script-url"
                value={scriptUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Collaboration Status */}
          {collaborationEnabled ? (
            <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Active Collaborators</Label>
              </div>
              {collaboration.connectionStatus === "connected" ? (
                <div className="mt-2">
                  <Collaborators
                    collaborators={collaboration.collaborators}
                    currentUser={collaboration.currentUser}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Anyone with this link can view and edit when collaboration is enabled
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Connecting to collaboration server...
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Enable collaboration mode (Users icon) to allow
                real-time editing with others.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium mb-2">How to collaborate:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Copy and share the link above</li>
              <li>Enable collaboration mode (Users icon in toolbar)</li>
              <li>Have your collaborator open the link and sign in</li>
              <li>They should also enable collaboration mode</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

