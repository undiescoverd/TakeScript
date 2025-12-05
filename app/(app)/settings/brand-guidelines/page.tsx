import { BrandGuidelinesManager } from "@/components/brand-guidelines/BrandGuidelinesManager";
import { getFeatureFlags } from "@/lib/feature-flags";
import { redirect } from "next/navigation";

export default function BrandGuidelinesPage() {
  const flags = getFeatureFlags();

  if (!flags.aiBrandGuidelinesEnabled) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <BrandGuidelinesManager />
    </div>
  );
}
