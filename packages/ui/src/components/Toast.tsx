"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { resolveText, type LocalizedText, useLocale } from "../locale-context";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ToastProps {
  type: "success" | "error" | "warning" | "info";
  title: string | LocalizedText;
  description?: string | LocalizedText;
  onClose?: () => void;
}

export const Toast = ({ type, title, description, onClose }: ToastProps) => {
  const { locale } = useLocale();
  const config = {
    success: { icon: "OK", bg: "bg-emerald-50", border: "border-emerald-200", title: "text-emerald-700" },
    error: { icon: "X", bg: "bg-red-50", border: "border-red-200", title: "text-red-700" },
    warning: { icon: "!", bg: "bg-orange-50", border: "border-orange-200", title: "text-orange-700" },
    info: {
      icon: "i",
      bg: "bg-[var(--primary-50)]",
      border: "border-[var(--border-default)]",
      title: "text-[var(--primary-800)]",
    },
  }[type];

  return (
    <div
      className={cn(
        "group relative flex w-full max-w-sm gap-4 overflow-hidden rounded-[28px] border p-5 shadow-[0_16px_40px_rgba(19,78,74,0.12)] backdrop-blur-3xl transition-all duration-300 hover:translate-y-[-1px]",
        "animate-fade-up",
        config.bg,
        config.border,
      )}
    >
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

      <div
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border text-xs font-black transition-transform group-hover:rotate-6",
          config.bg,
          config.title,
          config.border,
        )}
      >
        {config.icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-black tracking-tight", config.title)}>{resolveText(title, locale)}</p>
        {description ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-90">
            {resolveText(description, locale)}
          </p>
        ) : null}
      </div>

      {onClose ? (
        <button
          onClick={onClose}
          className="h-7 w-7 self-start rounded-lg text-[var(--text-tertiary)] transition-all hover:bg-black/5 hover:text-[var(--text-primary)] active:scale-90"
          type="button"
        >
          X
        </button>
      ) : null}

      <div className={cn("absolute bottom-0 start-0 h-1 rounded-full bg-current opacity-40", config.title)} style={{ width: "40%" }} />
    </div>
  );
};
