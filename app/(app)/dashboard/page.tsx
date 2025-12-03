"use client";

import { useQuery } from "convex/react";
import { UserButton } from "@clerk/nextjs";
import { ScriptGrid } from "@/components/dashboard/ScriptGrid";
import { NewScriptDialog } from "@/components/dashboard/NewScriptDialog";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { api } from "@/convex/_generated/api";
import { FileText, TrendingUp, CheckCircle, Activity, FolderOpen } from "lucide-react";

export default function DashboardPage() {
  const stats = useQuery(api.analytics.getUserStats);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">My Scripts</h2>
            <p className="text-muted-foreground">
              Create and manage your tutorial scripts
            </p>
          </div>
          <NewScriptDialog />
        </div>

        <ScriptGrid />
      </main>
    </div>
  );
}
