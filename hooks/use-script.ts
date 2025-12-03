"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function useScript(scriptId: Id<"scripts">) {
  const script = useQuery(api.scripts.get, { scriptId });
  return script;
}

export function useScripts() {
  const scripts = useQuery(api.scripts.list);
  return scripts;
}
