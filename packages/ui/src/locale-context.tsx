"use client";

import React from "react";

export type AppLocale = "ar" | "en";

export type LocalizedText = {
  ar: string;
  en: string;
};

type LocaleContextValue = {
  locale: AppLocale;
  direction: "rtl" | "ltr";
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (value: string | LocalizedText) => string;
};

const LocaleContext = React.createContext<LocaleContextValue | undefined>(undefined);

function resolveInitialLocale(): AppLocale {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang?.toLowerCase();
    if (lang.startsWith("ar")) return "ar";
    if (lang.startsWith("en")) return "en";
  }

  if (typeof window === "undefined") {
    return "ar";
  }

  const saved = window.localStorage.getItem("tayyar-locale");
  if (saved === "ar" || saved === "en") {
    return saved;
  }

  return window.navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale === "ar" ? "ar-EG" : "en";
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.documentElement.dataset.locale = locale;
}

export function resolveText(value: string | LocalizedText, locale: AppLocale) {
  if (typeof value === "string") {
    return value;
  }

  const resolved = locale === "ar" ? value.ar : value.en;
  if (!resolved) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Missing translation", { locale, value });
    }
    return locale === "ar" ? value.en : value.ar;
  }
  return resolved;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>("ar");

  React.useEffect(() => {
    const next = resolveInitialLocale();
    setLocaleState(next);
    applyDocumentLocale(next);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "tayyar-locale") {
        return;
      }

      const value = event.newValue;
      if (value === "ar" || value === "en") {
        setLocaleState(value);
        applyDocumentLocale(value);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setLocale = React.useCallback((next: AppLocale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tayyar-locale", next);
    }
    applyDocumentLocale(next);
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  const value = React.useMemo<LocaleContextValue>(
    () => ({
      locale,
      direction: locale === "ar" ? "rtl" : "ltr",
      setLocale,
      toggleLocale,
      t: (value) => resolveText(value, locale),
    }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = React.useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return context;
}

export function useLocalizedText() {
  const { locale } = useLocale();
  return React.useCallback(
    (value: string | LocalizedText) => resolveText(value, locale),
    [locale],
  );
}
