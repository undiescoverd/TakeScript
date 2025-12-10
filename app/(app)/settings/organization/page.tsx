"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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

// OpenRouter model options - unified access to multiple providers
const OPENROUTER_MODELS = [
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic" },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "google/gemini-pro", name: "Gemini Pro", provider: "Google" },
] as const;

const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

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
  const [openrouterModel, setOpenrouterModel] = useState(DEFAULT_MODEL);

  useEffect(() => {
    if (organization && "name" in organization) {
      setName(organization.name);
      // Use openrouterModel if available, otherwise default
      if ("openrouterModel" in organization && organization.openrouterModel) {
        setOpenrouterModel(organization.openrouterModel);
      }
    }
  }, [organization]);

  const handleSaveName = async () => {
    if (!organization || !("_id" in organization)) return;
    try {
      await updateOrganization({
        organizationId: organization._id as Id<"organizations">,
        name,
      });
      toast.success("Organization name updated");
    } catch (error) {
      toast.error("Failed to update organization name");
    }
  };

  const handleSaveAISettings = async () => {
    if (!organization || !("_id" in organization)) return;
    try {
      await updateAISettings({
        organizationId: organization._id as Id<"organizations">,
        openrouterModel,
      });
      toast.success("AI settings updated");
    } catch (error) {
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

      {flags.aiEnabled && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Settings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select the AI model to use for script assistance. Models are accessed
            via OpenRouter for unified billing and reliability.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ai-model">AI Model</Label>
              <Select
                value={openrouterModel}
                onValueChange={setOpenrouterModel}
              >
                <SelectTrigger id="ai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENROUTER_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} ({model.provider})
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
