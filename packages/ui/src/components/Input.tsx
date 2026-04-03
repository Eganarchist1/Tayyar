"use client";

import * as React from "react";
import { cn } from "../lib/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-12 w-full rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-text-primary sm:min-h-[3.25rem]",
          "placeholder:text-text-tertiary/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300",
          "focus:border-primary-400/70 focus:bg-[var(--bg-surface-2)] focus:outline-none focus:ring-4 focus:ring-primary-500/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "app-font-body",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
