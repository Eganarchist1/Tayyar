"use client";

import React from "react";
import { cn } from "../lib/cn";
import { Card } from "./Card";

export function Skeleton({
  className,
  shimmer = true,
}: {
  className?: string;
  shimmer?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[var(--bg-surface-2)]/70",
        shimmer && "animate-shimmer",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function PageScaffoldSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="space-y-8">
      <Card variant="elevated" className="space-y-5 overflow-hidden">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-2/3 max-w-xl" />
          <Skeleton className="h-5 w-full max-w-3xl" />
          <Skeleton className="h-5 w-4/5 max-w-2xl" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
      </Card>

      <section className="panel-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-12 rounded-[18px]" />
            </div>
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </section>

      <section className={cn("grid gap-6", compact ? "xl:grid-cols-2" : "xl:grid-cols-[1.15fr_0.85fr]")}>
        <Card className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-64" />
            </div>
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-56" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
              >
                <div className="space-y-3">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
