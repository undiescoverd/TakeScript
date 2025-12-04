"use client";

import { CollaborationUser } from "@/hooks/use-collaboration";

interface CollaboratorsProps {
  collaborators: CollaborationUser[];
  currentUser: CollaborationUser | null;
  maxVisible?: number;
}

export function Collaborators({
  collaborators,
  currentUser,
  maxVisible = 5,
}: CollaboratorsProps) {
  const allUsers = currentUser
    ? [currentUser, ...collaborators]
    : collaborators;
  const visibleUsers = allUsers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, allUsers.length - maxVisible);

  if (allUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        {visibleUsers.map((user, index) => (
          <div
            key={user.id}
            className="relative"
            style={{ zIndex: visibleUsers.length - index }}
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                title={user.id === currentUser?.id ? `${user.name} (you)` : user.name}
                className="h-7 w-7 rounded-full border-2 border-background object-cover"
                style={{ borderColor: user.color }}
              />
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background text-xs font-medium text-white"
                style={{ backgroundColor: user.color }}
                title={user.id === currentUser?.id ? `${user.name} (you)` : user.name}
              >
                {getInitials(user.name)}
              </div>
            )}
            {/* Online indicator */}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500"
              title="Online"
            />
          </div>
        ))}

        {/* Hidden users count */}
        {hiddenCount > 0 && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground"
            title={`${hiddenCount} more collaborator${hiddenCount > 1 ? "s" : ""}`}
          >
            +{hiddenCount}
          </div>
        )}
      </div>

      {/* Collaborator count label */}
      <span className="ml-2 text-xs text-muted-foreground">
        {allUsers.length === 1
          ? "Just you"
          : `${allUsers.length} editing`}
      </span>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
