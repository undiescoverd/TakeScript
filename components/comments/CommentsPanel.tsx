"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, X, Check, Trash2, Send } from "lucide-react";
import { formatDistanceToNow } from "@/lib/utils";
import { toast } from "sonner";

interface CommentsPanelProps {
  scriptId: Id<"scripts">;
  isOpen: boolean;
  onClose: () => void;
}

export function CommentsPanel({
  scriptId,
  isOpen,
  onClose,
}: CommentsPanelProps) {
  const comments = useQuery(api.comments.list, { scriptId });
  const createComment = useMutation(api.comments.create);
  const toggleResolve = useMutation(api.comments.toggleResolve);
  const removeComment = useMutation(api.comments.remove);

  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await createComment({
        scriptId,
        content: newComment.trim(),
        position: "general", // Can be enhanced to target specific blocks
      });
      setNewComment("");
      toast.success("Comment added");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleResolve = async (commentId: Id<"comments">) => {
    try {
      await toggleResolve({ commentId });
    } catch {
      toast.error("Failed to update comment");
    }
  };

  const handleDelete = async (commentId: Id<"comments">) => {
    try {
      await removeComment({ commentId });
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex w-80 flex-col border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-medium">Comments</span>
          {comments && comments.length > 0 && (
            <span className="text-sm text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* New Comment Form */}
      <form onSubmit={handleSubmit} className="border-b p-3">
        <div className="flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isSubmitting || !newComment.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-3">
        {comments === undefined ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <MessageSquare className="mb-2 h-8 w-8" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs">Add one to start the discussion</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment._id}
                className={`rounded-lg border p-3 ${
                  comment.resolved ? "bg-muted/50" : "bg-background"
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      {comment.user?.name || "Unknown User"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(comment.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleToggleResolve(comment._id)}
                      title={comment.resolved ? "Unresolve" : "Resolve"}
                    >
                      <Check
                        className={`h-3 w-3 ${
                          comment.resolved ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDelete(comment._id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <p
                  className={`text-sm ${
                    comment.resolved ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {comment.content}
                </p>
                {comment.resolved && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    ✓ Resolved
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
