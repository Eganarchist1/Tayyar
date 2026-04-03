"use client";

import React from "react";
import {
  getDirection,
  resolveLocalizedValue,
  type AppDirection,
  type AppLocale,
  type LocalizedValue,
} from "@tayyar/utils";

type HeroLocaleContextValue = {
  locale: AppLocale;
  direction: AppDirection;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (value: string | LocalizedValue) => string;
};

const HeroLocaleContext = React.createContext<HeroLocaleContextValue | undefined>(undefined);

function resolveInitialLocale(): AppLocale {
  if (typeof document !== "undefined") {
    const current = document.documentElement.lang?.toLowerCase();
    if (current.startsWith("en")) return "en";
    if (current.startsWith("ar")) return "ar";
  }

  if (typeof window === "undefined") {
    return "ar";
  }

  const saved = window.localStorage.getItem("tayyar-hero-locale");
  if (saved === "ar" || saved === "en") {
    return saved;
  }

  return window.navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function applyLocale(locale: AppLocale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale === "ar" ? "ar-EG" : "en";
  document.documentElement.dir = getDirection(locale);
  document.documentElement.dataset.locale = locale;
}

export function HeroLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>("ar");

  React.useEffect(() => {
    const nextLocale = resolveInitialLocale();
    setLocaleState(nextLocale);
    applyLocale(nextLocale);
  }, []);

  const setLocale = React.useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tayyar-hero-locale", nextLocale);
    }
    applyLocale(nextLocale);
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  const value = React.useMemo<HeroLocaleContextValue>(
    () => ({
      locale,
      direction: getDirection(locale),
      setLocale,
      toggleLocale,
      t: (value) => resolveLocalizedValue(value, locale),
    }),
    [locale, setLocale, toggleLocale],
  );

  return <HeroLocaleContext.Provider value={value}>{children}</HeroLocaleContext.Provider>;
}

export function useHeroLocale() {
  const context = React.useContext(HeroLocaleContext);
  if (!context) {
    throw new Error("useHeroLocale must be used within HeroLocaleProvider");
  }
  return context;
}
