"use client";

import React from "react";
import { cn } from "../lib/cn";

type ButtonVariant =
  | "primary"
  | "default"
  | "gold"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline"
  | "link";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--primary-600)] text-white shadow-[0_16px_40px_-20px_rgba(13,148,136,0.45)] hover:bg-[var(--primary-700)] active:scale-[0.98]",
  primary:
    "bg-[var(--primary-600)] text-white shadow-[0_16px_40px_-20px_rgba(13,148,136,0.45)] hover:bg-[var(--primary-700)] active:scale-[0.98]",
  gold:
    "bg-[var(--accent-500)] text-amber-950 shadow-[0_16px_40px_-20px_rgba(234,179,8,0.38)] hover:brightness-105 active:scale-[0.98]",
  secondary:
    "bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-[0_4px_16px_rgba(19,78,74,0.06)] hover:bg-[var(--bg-surface)] hover:border-[var(--border-strong)] active:scale-[0.985]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-[0.985]",
  danger:
    "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-[0.985]",
  outline:
    "bg-transparent text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface)] hover:border-[var(--primary-400)] active:scale-[0.985]",
  link:
    "h-auto rounded-none bg-transparent px-0 py-0 text-[var(--primary-600)] underline-offset-4 hover:text-[var(--primary-700)] hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "min-h-10 rounded-xl px-3.5 py-2 text-[11px]",
  sm: "min-h-12 rounded-2xl px-4.5 py-2.5 text-sm",
  md: "min-h-12 rounded-[18px] px-5 py-3 text-sm sm:min-h-[3.25rem]",
  lg: "min-h-14 rounded-[22px] px-6 py-3.5 text-base sm:min-h-[3.75rem]",
  xl: "min-h-16 rounded-[26px] px-8 py-4 text-lg",
  hero: "min-h-16 rounded-[28px] px-8 py-4 text-lg font-black",
  icon: "h-12 w-12 rounded-2xl p-0 sm:h-[3.25rem] sm:w-[3.25rem]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      fullWidth,
      icon,
      iconPosition = "start",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const iconNode = loading ? (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
    ) : (
      icon
    );

    return (
      <button
        ref={ref}
        disabled={loading || disabled}
        className={cn(
          "app-font-body inline-flex items-center justify-center gap-2 text-center leading-5 font-bold transition-all duration-300 touch-manipulation select-none",
          "active:translate-y-px",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          size !== "icon" && "min-w-fit",
          sizeClasses[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {iconNode && iconPosition === "start" ? <span className="shrink-0">{iconNode}</span> : null}
        {children}
        {iconNode && iconPosition === "end" ? <span className="shrink-0">{iconNode}</span> : null}
      </button>
    );
  },
);

Button.displayName = "Button";
