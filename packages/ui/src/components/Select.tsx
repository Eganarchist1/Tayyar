"use client";

import React from "react";
import { cn } from "../lib/cn";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  icon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, icon, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        {icon && (
          <div className="pointer-events-none absolute start-4 text-[var(--text-tertiary)]">
            {icon}
          </div>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            "app-font-body flex min-h-12 w-full appearance-none rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] py-3 text-sm text-[var(--text-primary)] transition-all duration-300 sm:min-h-[3.25rem]",
            icon ? "ps-11 pe-10" : "px-4 pe-10",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
            "focus:border-primary-400/70 focus:bg-[var(--bg-surface-2)] focus:outline-none focus:ring-4 focus:ring-primary-500/10",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute end-4 text-[var(--text-tertiary)] opacity-75">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";
