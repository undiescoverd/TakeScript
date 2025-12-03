"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ScriptCard } from "./ScriptCard";
import { FileText } from "lucide-react";

export function ScriptGrid() {
  const scripts = useQuery(api.scripts.list);

  if (scripts === undefined) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg border bg-muted"
          />
        ))}
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-medium">No scripts yet</h3>
        <p className="text-muted-foreground">
          Create your first script to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {scripts.map((script) => (
        <ScriptCard key={script._id} script={script} />
      ))}
    </div>
  );
}
