"use client";

import React from "react";
import { cn } from "../lib/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "elevated" | "gold-accent";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
}

const variantClasses = {
  default:
    "border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]",
  glass:
    "border border-[var(--border-default)] bg-[var(--bg-glass)] backdrop-blur-2xl shadow-[var(--shadow-glass)]",
  elevated:
    "border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[var(--shadow-raised)]",
  "gold-accent":
    "border border-[var(--border-gold)] bg-[var(--accent-50)] shadow-[var(--shadow-glow-gold)]",
} as const;

const paddingClasses = {
  none: "p-0",
  sm: "p-4",
  md: "p-4 sm:p-6",
  lg: "p-5 sm:p-8",
  xl: "p-10",
} as const;

export function Card({
  className,
  variant = "glass",
  padding = "md",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-[22px] text-text-primary transition-all duration-300 md:rounded-[28px] md:motion-safe:hover:-translate-y-[2px]",
        "motion-safe:active:translate-y-px",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        variantClasses[variant],
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("font-display-ar text-xl font-black tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative", className)} {...props}>
      {children}
    </div>
  );
}
