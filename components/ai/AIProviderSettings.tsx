"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { ProviderConfigForm } from "@/components/ai/ProviderConfigForm";

const SOURCE_LABELS: Record<string, string> = {
  user: "AI requests are using your personal key.",
  org: "AI requests are using your organization's key.",
  platform: "AI requests are using the TakeScript platform key.",
};

/**
 * BYOK provider settings: effective-source banner + personal and org forms.
 * Rendered on /settings/ai and inside the Clerk account modal's
 * "AI Integration" page.
 */
export function AIProviderSettings() {
  const configs = useQuery(api.aiProviders.getMyConfigs);

  if (configs === undefined) {
    return <div className="py-8 text-sm text-muted-foreground">Loading...</div>;
  }

  const canManageOrg = configs?.role === "owner" || configs?.role === "admin";

  return (
    <div className="space-y-6">
      {configs && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm">
          {SOURCE_LABELS[configs.effectiveSource]}
        </div>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-1">Personal AI Provider</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Overrides the organization default for your requests only.
        </p>
        <ProviderConfigForm scope="user" config={configs?.user} />
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-1">Organization Default</h3>
        <p className="text-muted-foreground text-sm mb-4">
          {canManageOrg
            ? "Used by everyone in your organization who has no personal key."
            : "Only organization owners and admins can change this."}
        </p>
        <ProviderConfigForm
          scope="org"
          config={configs?.org}
          disabled={!canManageOrg}
        />
      </Card>
    </div>
  );
}
