"use client";

import { UserButton } from "@clerk/nextjs";
import { ScriptGrid } from "@/components/dashboard/ScriptGrid";
import { NewScriptDialog } from "@/components/dashboard/NewScriptDialog";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function DashboardPage() {
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
