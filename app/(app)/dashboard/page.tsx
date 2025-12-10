"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { UserButton } from "@clerk/nextjs";
import { ScriptGrid } from "@/components/dashboard/ScriptGrid";
import { NewScriptDialog } from "@/components/dashboard/NewScriptDialog";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { TemplateLibrary } from "@/components/templates/TemplateLibrary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { FileText, TrendingUp, CheckCircle, Activity, FolderOpen, Layout, FilePlus } from "lucide-react";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import { toast } from "sonner";

export default function DashboardPage() {
  const stats = useQuery(api.analytics.getUserStats);
  const templatesEnabled = useFeatureFlag("templatesLibraryEnabled");
  const router = useRouter();
  const createScript = useMutation(api.scripts.create);
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);

  const handleCreateBlankScript = async () => {
    setIsCreatingBlank(true);
    try {
      const scriptId = await createScript({
        title: "Untitled Script",
      });
      router.push(`/script/${scriptId}`);
      toast.success("Blank script created");
    } catch {
      toast.error("Failed to create script");
    } finally {
      setIsCreatingBlank(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">TakeScript</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/login" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Analytics Stats */}
        {stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatsCard
              title="Total Scripts"
              value={stats.totalScripts}
              description="All your scripts"
              icon={FileText}
            />
            <StatsCard
              title="Total Words"
              value={stats.totalWordCount.toLocaleString()}
              description="Across all scripts"
              icon={TrendingUp}
            />
            <StatsCard
              title="Completed"
              value={stats.completedScripts}
              description="Ready to record"
              icon={CheckCircle}
            />
            <StatsCard
              title="Recent Activity"
              value={stats.recentActivity}
              description="Last 7 days"
              icon={Activity}
            />
            <StatsCard
              title="Categories"
              value={stats.categories}
              description="Projects organized"
              icon={FolderOpen}
            />
          </div>
        )}

        {templatesEnabled ? (
          <Tabs defaultValue="scripts" className="space-y-6">
            <TabsList>
              <TabsTrigger value="scripts" className="gap-2">
                <FileText className="h-4 w-4" />
                Scripts
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <Layout className="h-4 w-4" />
                Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scripts" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">My Scripts</h2>
                  <p className="text-muted-foreground">
                    Create and manage your tutorial scripts
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCreateBlankScript}
                    disabled={isCreatingBlank}
                  >
                    <FilePlus className="mr-2 h-4 w-4" />
                    {isCreatingBlank ? "Creating..." : "Blank Script"}
                  </Button>
                  <NewScriptDialog />
                </div>
              </div>

              <ScriptGrid />
            </TabsContent>

            <TabsContent value="templates" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Templates</h2>
                  <p className="text-muted-foreground">
                    Manage your reusable script templates
                  </p>
                </div>
              </div>

              <TemplateLibrary />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">My Scripts</h2>
                <p className="text-muted-foreground">
                  Create and manage your tutorial scripts
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleCreateBlankScript}
                  disabled={isCreatingBlank}
                >
                  <FilePlus className="mr-2 h-4 w-4" />
                  {isCreatingBlank ? "Creating..." : "Blank Script"}
                </Button>
                <NewScriptDialog />
              </div>
            </div>

            <ScriptGrid />
          </div>
        )}
      </main>
    </div>
  );
}
