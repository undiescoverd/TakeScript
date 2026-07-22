"use client";

import { AIProviderSettings } from "@/components/ai/AIProviderSettings";
import { getFeatureFlags } from "@/lib/feature-flags";

export default function AISettingsPage() {
  const flags = getFeatureFlags();

  if (!flags.aiEnabled || !flags.aiByokEnabled) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <h1 className="text-3xl font-bold">AI Providers</h1>
        <p className="text-muted-foreground mt-2">
          This feature is not enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Providers</h1>
        <p className="text-muted-foreground">
          Bring your own API key for AI features. Your personal key takes
          priority, then your organization&apos;s key, then the TakeScript
          platform key.
        </p>
      </div>

      <AIProviderSettings />
    </div>
  );
}
