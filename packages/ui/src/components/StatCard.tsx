"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "../lib/cn";
import { resolveText, type LocalizedText, useLocale } from "../locale-context";

interface StatCardProps {
  label?: string | LocalizedText;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: { value: number; direction: "up" | "down"; text?: string | LocalizedText };
  accentColor?: "primary" | "gold" | "success" | "danger" | "warning";
  subValue?: string | LocalizedText;
  loading?: boolean;
  className?: string;
}

const palette = {
  primary: {
    frame: "border-[var(--border-default)] bg-[var(--bg-surface)]",
    badge: "bg-[var(--primary-100)] text-[var(--primary-800)] border-[var(--border-strong)]",
    accent: "from-[rgba(var(--primary-rgb),0.16)]",
  },
  gold: {
    frame: "border-[var(--border-gold)] bg-[var(--bg-surface)]",
    badge: "bg-[var(--accent-100)] text-[var(--accent-800)] border-[var(--border-gold)]",
    accent: "from-[rgba(var(--accent-rgb),0.18)]",
  },
  success: {
    frame: "border-[color:rgba(21,128,61,0.22)] bg-[var(--bg-surface)]",
    badge: "bg-[color:rgba(21,128,61,0.12)] text-[var(--success-500)] border-[color:rgba(21,128,61,0.22)]",
    accent: "from-[rgba(34,197,94,0.16)]",
  },
  danger: {
    frame: "border-[color:rgba(185,28,28,0.22)] bg-[var(--bg-surface)]",
    badge: "bg-[color:rgba(185,28,28,0.12)] text-[var(--danger-500)] border-[color:rgba(185,28,28,0.22)]",
    accent: "from-[rgba(239,68,68,0.16)]",
  },
  warning: {
    frame: "border-[color:rgba(194,65,12,0.22)] bg-[var(--bg-surface)]",
    badge: "bg-[color:rgba(194,65,12,0.12)] text-[var(--warning-500)] border-[color:rgba(194,65,12,0.22)]",
    accent: "from-[rgba(249,115,22,0.16)]",
  },
} as const;

export function StatCard({
  label,
  value,
  suffix,
  icon,
  trend,
  accentColor = "primary",
  subValue,
  loading,
  className,
}: StatCardProps) {
  const { locale } = useLocale();
  const tone = palette[accentColor];
  const resolvedLabel = resolveText(label || "", locale);
  const resolvedSubValue = subValue ? resolveText(subValue, locale) : null;
  const resolvedTrendText = trend?.text ? resolveText(trend.text, locale) : null;

  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[22px] border p-4 backdrop-blur-xl transition-all duration-300 sm:rounded-[24px] sm:p-5 lg:rounded-[28px] lg:p-6",
        "bg-[linear-gradient(180deg,var(--bg-surface),var(--bg-surface-2))] shadow-[var(--shadow-card)]",
        "before:absolute before:inset-x-0 before:top-0 before:h-20 before:bg-gradient-to-b before:to-transparent",
        tone.frame,
        tone.accent,
        className,
      )}
    >
      <div className="relative z-10 flex justify-between gap-3 sm:gap-4" style={{ alignItems: "flex-start" }}>
        <div className="min-w-0 space-y-3">
          <p className="text-xs font-bold text-[var(--text-secondary)]">{resolvedLabel}</p>
          {loading ? (
            <div className="space-y-2">
              <div className="h-10 w-28 animate-pulse rounded-xl bg-[var(--bg-surface-2)]" />
              <div className="h-4 w-20 animate-pulse rounded-lg bg-[var(--bg-overlay)]" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" style={{ alignItems: "flex-end" }}>
                <span className="font-mono text-[1.75rem] font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
                  {value}
                </span>
                {suffix ? <span className="pb-1 text-sm text-[var(--text-secondary)]">{suffix}</span> : null}
              </div>
              {resolvedSubValue ? <p className="text-sm text-[var(--text-secondary)]">{resolvedSubValue}</p> : null}
            </>
          )}
        </div>

        {icon ? (
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border sm:h-12 sm:w-12", tone.badge)}>
            {icon}
          </div>
        ) : null}
      </div>

      {trend && !loading ? (
        <div
          className={cn(
            "relative z-10 mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold",
            trend.direction === "up"
              ? "border-[color:rgba(21,128,61,0.22)] bg-[color:rgba(21,128,61,0.1)] text-[var(--success-500)]"
              : "border-[color:rgba(185,28,28,0.22)] bg-[color:rgba(185,28,28,0.1)] text-[var(--danger-500)]",
          )}
        >
          <ArrowUpRight className={cn("h-3.5 w-3.5 transition-transform", trend.direction === "down" && "rotate-90")} />
          <span className="font-mono">{trend.value}%</span>
          {resolvedTrendText ? <span>{resolvedTrendText}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
