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
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai">("anthropic");
  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4-5-20250929");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o");

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setAiProvider((organization.aiProvider as "anthropic" | "openai") || "anthropic");
      setAnthropicModel(organization.anthropicModel || "claude-sonnet-4-5-20250929");
      setOpenaiModel(organization.openaiModel || "gpt-4o");
    }
  }, [organization]);

  const handleSaveName = async () => {
    if (!organization) return;
    try {
      await updateOrganization({ organizationId: organization._id, name });
      toast.success("Organization name updated");
    } catch (error) {
      toast.error("Failed to update organization name");
    }
  };

  const handleSaveAISettings = async () => {
    if (!organization) return;
    try {
      await updateAISettings({
        organizationId: organization._id,
        aiProvider,
        anthropicModel,
        openaiModel,
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
          <div className="space-y-4">
            <div>
              <Label htmlFor="ai-provider">AI Provider</Label>
              <Select
                value={aiProvider}
                onValueChange={(value: "anthropic" | "openai") => setAiProvider(value)}
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {aiProvider === "anthropic" && (
              <div>
                <Label htmlFor="anthropic-model">Claude Model</Label>
                <Select
                  value={anthropicModel}
                  onValueChange={setAnthropicModel}
                >
                  <SelectTrigger id="anthropic-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-sonnet-4-5-20250929">
                      Claude Sonnet 4.5
                    </SelectItem>
                    <SelectItem value="claude-opus-4-5-20241101">
                      Claude Opus 4.5
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {aiProvider === "openai" && (
              <div>
                <Label htmlFor="openai-model">OpenAI Model</Label>
                <Select value={openaiModel} onValueChange={setOpenaiModel}>
                  <SelectTrigger id="openai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

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
