"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getFeatureFlags } from "@/lib/feature-flags";
import { OPENROUTER_MODELS } from "@/lib/ai-models";

export default function OrganizationSettingsPage() {
  const flags = getFeatureFlags();
  const user = useQuery(api.users.current);
  const organization = useQuery(
    api.organizations.getCurrent,
    user?.organizationId ? {} : "skip"
  );
  const updateOrganization = useMutation(api.organizations.update);
  const updateAISettings = useMutation(api.organizations.updateAISettings);

  const [name, setName] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState(
    "anthropic/claude-sonnet-5"
  );

  useEffect(() => {
    if (organization && "slug" in organization) {
      setName(organization.name);
      setOpenrouterModel(
        organization.openrouterModel ?? "anthropic/claude-sonnet-5"
      );
    }
  }, [organization]);

  const handleSaveName = async () => {
    if (!organization || !("slug" in organization)) return;
    try {
      await updateOrganization({ organizationId: organization._id, name });
      toast.success("Organization name updated");
    } catch {
      toast.error("Failed to update organization name");
    }
  };

  const handleSaveAISettings = async () => {
    if (!organization || !("slug" in organization)) return;
    try {
      await updateAISettings({
        organizationId: organization._id,
        openrouterModel,
      });
      toast.success("AI settings updated");
    } catch {
      toast.error("Failed to update AI settings");
    }
  };

  if (!organization) {
    return <div className="container mx-auto py-8 max-w-4xl">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization details and preferences
        </p>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Organization Details</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Company"
            />
          </div>

          <Button onClick={handleSaveName}>Save Changes</Button>
        </div>
      </Card>

      {flags.aiEnabled && flags.aiByokEnabled && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">AI Providers</h3>
          <p className="text-muted-foreground mb-4">
            Configure organization and personal AI provider keys (BYOK)
          </p>
          <Link href="/settings/ai">
            <Button variant="outline">Manage AI Providers</Button>
          </Link>
        </Card>
      )}

      {flags.aiEnabled && !flags.aiByokEnabled && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Settings</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="openrouter-model">Model (via OpenRouter)</Label>
              <Select
                value={openrouterModel}
                onValueChange={setOpenrouterModel}
              >
                <SelectTrigger id="openrouter-model">
                  <SelectValue />
                </SelectTrigger>
                {/* Driven from lib/ai-models.ts so this list can't drift out
                    of sync with the BYOK picker — it previously hardcoded four
                    models that had all been retired. */}
                <SelectContent>
                  {OPENROUTER_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSaveAISettings}>Save AI Settings</Button>
          </div>
        </Card>
      )}

      {flags.aiBrandGuidelinesEnabled && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Brand Guidelines</h3>
          <p className="text-muted-foreground mb-4">
            Upload and manage brand guidelines for AI-powered writing assistance
          </p>
          <Link href="/settings/brand-guidelines">
            <Button variant="outline">Manage Brand Guidelines</Button>
          </Link>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-2">Team Management</h3>
        <p className="text-muted-foreground mb-4">
          Invite team members and manage roles
        </p>
        <Link href="/settings/team">
          <Button variant="outline">Manage Team</Button>
        </Link>
      </Card>
    </div>
  );
}
