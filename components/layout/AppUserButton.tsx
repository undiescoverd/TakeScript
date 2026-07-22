"use client";

import { UserButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";
import { AIProviderSettings } from "@/components/ai/AIProviderSettings";
import { getFeatureFlags } from "@/lib/feature-flags";

/**
 * Clerk UserButton with the app's custom account pages. The "AI Integration"
 * page surfaces BYOK provider settings inside the manage-account modal.
 */
export function AppUserButton() {
  const flags = getFeatureFlags();

  return (
    <UserButton afterSignOutUrl="/login">
      {flags.aiEnabled && flags.aiByokEnabled && (
        <UserButton.UserProfilePage
          label="AI Integration"
          url="ai-integration"
          labelIcon={<Sparkles className="h-4 w-4" />}
        >
          <div className="space-y-4">
            <div className="border-b border-border pb-4">
              <h1 className="text-[1.05rem] font-bold">AI Integration</h1>
              <p className="text-sm text-muted-foreground">
                Bring your own API key for AI features. Your personal key takes
                priority, then your organization&apos;s key, then the TakeScript
                platform key.
              </p>
            </div>
            <AIProviderSettings />
          </div>
        </UserButton.UserProfilePage>
      )}
    </UserButton>
  );
}
