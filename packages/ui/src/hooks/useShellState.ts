"use client";

import React from "react";

const DESKTOP_BREAKPOINT = 768;
const COLLAPSE_KEY = "tayyar-shell-collapsed";

export function useShellState() {
  const [collapsed, setCollapsedState] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const mobileTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const mobileCloseRef = React.useRef<HTMLButtonElement | null>(null);
  const mobilePanelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.localStorage.getItem(COLLAPSE_KEY) === "true") {
      setCollapsedState(true);
    }
  }, []);

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const syncBodyState = () => {
      const desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      if (mobileOpen && !desktop) {
        document.body.style.overflow = "hidden";
        window.requestAnimationFrame(() => {
          mobileCloseRef.current?.focus();
        });
        return;
      }

      document.body.style.overflow = "";
      if (desktop && mobileOpen) {
        setMobileOpen(false);
      }
    };

    syncBodyState();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab" || !mobileOpen || window.innerWidth >= DESKTOP_BREAKPOINT) {
        return;
      }

      const panel = mobilePanelRef.current;
      if (!panel) {
        return;
      }

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleResize = () => {
      syncBodyState();
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileOpen]);

  const openMobile = React.useCallback(() => setMobileOpen(true), []);
  const closeMobile = React.useCallback(() => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => {
      mobileTriggerRef.current?.focus();
    });
  }, []);
  const setCollapsed = React.useCallback((next: boolean) => {
    setCollapsedState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COLLAPSE_KEY, String(next));
    }
  }, []);
  const toggleCollapsed = React.useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  return {
    collapsed,
    mobileOpen,
    setCollapsed,
    setMobileOpen,
    openMobile,
    closeMobile,
    toggleCollapsed,
    mobileTriggerRef,
    mobileCloseRef,
    mobilePanelRef,
  };
}
