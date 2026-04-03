"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { useLocale } from "../locale-context";
import { Input } from "./Input";

type InputWithIconProps = React.ComponentProps<typeof Input> & {
  icon: React.ReactNode;
  containerClassName?: string;
};

const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ icon, className, containerClassName, ...props }, ref) => {
    const { direction } = useLocale();

    return (
      <div className={cn("relative", containerClassName)}>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-tertiary",
            direction === "rtl" ? "right-4" : "left-4",
          )}
        >
          {icon}
        </span>
        <Input
          ref={ref}
          className={cn(direction === "rtl" ? "pr-11" : "pl-11", className)}
          {...props}
        />
      </div>
    );
  },
);

InputWithIcon.displayName = "InputWithIcon";

export { InputWithIcon };
