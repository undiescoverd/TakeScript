"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface Invitation {
  _id: Id<"organizationInvitations">;
  organizationId: Id<"organizations">;
  email: string;
  role: string;
  token: string;
  invitedBy: Id<"users">;
  status: string;
  expiresAt: number;
  createdAt: number;
}

interface Member {
  _id: Id<"users">;
  email: string;
  name: string;
  avatar?: string;
  tokenIdentifier: string;
  organizationId?: Id<"organizations">;
  role?: string;
}

export function TeamManagement() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const user = useQuery(api.users.current);
  const members = useQuery(
    api.organizations.getMembers,
    user?.organizationId ? { organizationId: user.organizationId } : "skip"
  );
  const invitations = useQuery(api.invitations.list);

  const createInvitation = useMutation(api.invitations.create);
  const revokeInvitation = useMutation(api.invitations.revoke);
  const removeMember = useMutation(api.invitations.removeMember);

  const handleInvite = async () => {
    if (!email) return;

    try {
      const result = await createInvitation({ email, role });
      toast.success("Invitation sent!");

      // Copy invite link to clipboard
      navigator.clipboard.writeText(result.inviteLink);
      toast.info("Invite link copied to clipboard");

      setEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    }
  };

  const handleRevoke = async (invitationId: Id<"organizationInvitations">) => {
    try {
      await revokeInvitation({ invitationId });
      toast.success("Invitation revoked");
    } catch (error) {
      toast.error("Failed to revoke invitation");
    }
  };

  const handleRemoveMember = async (userId: Id<"users">) => {
    if (
      confirm(
        "Remove this member from your organization? They will be moved to their own personal workspace."
      )
    ) {
      try {
        await removeMember({ userId });
        toast.success("Member removed");
      } catch (error: any) {
        toast.error(error.message || "Failed to remove member");
      }
    }
  };

  const copyInviteLink = (inviteLink: string, token: string) => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedToken(token);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getRoleBadgeVariant = (role: string | undefined) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Team Management</h2>
        <p className="text-muted-foreground">
          Invite team members and manage access to your organization
        </p>
      </div>

      {/* Invite Form */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
          </div>
          <div className="w-40">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleInvite} disabled={!email}>
              <UserPlus className="mr-2 h-4 w-4" />
              Send Invite
            </Button>
          </div>
        </div>
      </Card>

      {/* Pending Invitations */}
      {invitations && invitations.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Pending Invitations</h3>
          <div className="space-y-3">
            {invitations.map((invitation: Invitation) => (
              <div
                key={invitation._id}
                className="flex items-center justify-between p-3 bg-muted rounded-md"
              >
                <div className="flex-1">
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Role: {invitation.role} • Expires{" "}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyInviteLink(
                        `${window.location.origin}/invite/${invitation.token}`,
                        invitation.token
                      )
                    }
                  >
                    {copiedToken === invitation.token ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevoke(invitation._id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Team Members */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Team Members</h3>
        {members === undefined ? (
          <p>Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground">No team members yet</p>
        ) : (
          <div className="space-y-3">
            {members.map((member: Member) => (
              <div
                key={member._id}
                className="flex items-center justify-between p-3 bg-muted rounded-md"
              >
                <div className="flex items-center gap-3">
                  {member.avatar && (
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {member.role}
                  </Badge>
                </div>
                {member.role !== "owner" && user?.role === "owner" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveMember(member._id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
