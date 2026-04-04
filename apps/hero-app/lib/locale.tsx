import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { I18nManager } from "react-native";
import {
  getDirection,
  resolveLocalizedValue,
  type AppDirection,
  type AppLocale,
  type LocalizedValue,
} from "@tayyar/utils";

const HERO_LOCALE_KEY = "tayyar-hero-locale";

type HeroLocaleContextValue = {
  locale: AppLocale;
  direction: AppDirection;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (value: string | LocalizedValue) => string;
};

const HeroLocaleContext = React.createContext<HeroLocaleContextValue | undefined>(undefined);

async function resolveInitialLocale(): Promise<AppLocale> {
  const saved = await AsyncStorage.getItem(HERO_LOCALE_KEY);
  if (saved === "ar" || saved === "en") {
    return saved;
  }

  return I18nManager.isRTL ? "ar" : "ar";
}

export function HeroLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>("ar");

  React.useEffect(() => {
    let mounted = true;

    resolveInitialLocale()
      .then((nextLocale) => {
        if (mounted) {
          setLocaleState(nextLocale);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = React.useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    AsyncStorage.setItem(HERO_LOCALE_KEY, nextLocale).catch(() => undefined);
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
