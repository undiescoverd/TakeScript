"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: StatsCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span
                className={cn(
                  "font-medium",
                  trend.value > 0 ? "text-primary" : "text-muted-foreground"
                )}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value}
              </span>
              <span className="text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}
