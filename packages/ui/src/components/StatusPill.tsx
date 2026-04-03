"use client";

import React from "react";
import { cn } from "../lib/cn";
import { resolveText, useLocale, type LocalizedText } from "../locale-context";

export type Tone = "primary" | "gold" | "success" | "danger" | "warning" | "neutral" | "ghost";

export interface StatusPillProps {
  label: string | LocalizedText;
  tone?: Tone;
  className?: string;
  size?: "sm" | "md";
}

export function StatusPill({ label, tone = "neutral", size = "md", className }: StatusPillProps) {
  const { locale } = useLocale();

  const toneClasses: Record<Tone, string> = {
    primary: "border-[var(--border-strong)] bg-[var(--primary-100)] text-[var(--primary-800)] dark:bg-[var(--primary-900)] dark:text-[var(--primary-100)]",
    gold: "border-[var(--border-gold)] bg-[var(--accent-50)] text-[var(--accent-800)] dark:bg-[var(--accent-900)] dark:text-[var(--accent-100)]",
    success: "border-[color:rgba(16,185,129,0.2)] bg-[color:rgba(16,185,129,0.1)] text-[var(--success-600)] dark:text-[var(--success-400)] dark:border-[color:rgba(16,185,129,0.3)]",
    danger: "border-[color:rgba(239,68,68,0.2)] bg-[color:rgba(239,68,68,0.1)] text-[var(--danger-600)] dark:text-[var(--danger-400)]",
    warning: "border-[color:rgba(249,115,22,0.2)] bg-[color:rgba(249,115,22,0.1)] text-[var(--warning-600)] dark:text-[var(--warning-400)]",
    neutral: "border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]",
    ghost: "border-transparent bg-transparent text-[var(--text-secondary)]",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(
        "app-font-body inline-flex items-center justify-center rounded-full border font-bold",
        toneClasses[tone],
        sizeClasses[size],
        className
      )}
    >
      {resolveText(label, locale)}
    </span>
  );
}
