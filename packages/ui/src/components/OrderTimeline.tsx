"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { resolveText, type LocalizedText, useLocale } from "../locale-context";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TimelineStep {
  status?: LocalizedText;
  statusAr?: string;
  timestamp?: string;
  note?: LocalizedText;
  noteAr?: string;
  completed: boolean;
  active?: boolean;
}

export const OrderTimeline = ({ steps }: { steps: TimelineStep[] }) => {
  const { locale, direction } = useLocale();
  const isRtl = direction === "rtl";

  return (
    <div className="relative">
      <div
        className="absolute bottom-0 top-0 w-px bg-white/10"
        style={isRtl ? { right: "13px" } : { left: "13px" }}
      />
      <div className="space-y-6">
        {steps.map((step, index) => (
          <div
            key={index}
            className={cn("group relative flex items-start gap-5", isRtl ? "text-right" : "text-left")}
            style={isRtl ? { paddingRight: "36px" } : { paddingLeft: "36px" }}
          >
            <div
              className={cn(
                "absolute top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-500",
              )}
              style={{
                ...(isRtl ? { right: 0 } : { left: 0 }),
                background: step.active ? "var(--primary-500)" : step.completed ? "var(--bg-surface-2)" : "var(--bg-base)",
                borderColor: step.active ? "var(--primary-400)" : step.completed ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.08)",
                boxShadow: step.active ? "var(--shadow-glow-sky)" : "none",
                transform: step.active ? "scale(1.15)" : "scale(1)",
              }}
            >
              {step.completed && !step.active ? (
                <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              ) : step.active ? (
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-neutral-700/50" />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <h4
                className={cn(
                  "app-font-display text-base font-black leading-none transition-colors duration-300",
                  step.active ? "text-text-primary" : step.completed ? "text-text-secondary" : "text-text-tertiary/40",
                )}
              >
                {resolveText(step.status || step.statusAr || "", locale)}
              </h4>
              {step.timestamp ? (
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-tighter text-text-tertiary opacity-60 transition-opacity group-hover:opacity-100">
                  <span className="font-mono">{step.timestamp}</span>
                </p>
              ) : null}
              {step.note || step.noteAr ? (
                <div className="mt-2 rounded-2xl border border-white/5 bg-surface-2/40 p-3 backdrop-blur-sm">
                  <p className="app-font-body text-xs leading-relaxed text-text-secondary opacity-80 transition-opacity group-hover:opacity-100">
                    {resolveText(step.note || step.noteAr || "", locale)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
