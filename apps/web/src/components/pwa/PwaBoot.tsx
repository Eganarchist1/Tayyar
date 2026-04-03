"use client";

import React from "react";
import { Download, WifiOff, X } from "lucide-react";
import { Button, useLocale } from "@tayyar/ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "tayyar-pwa-install-dismissed";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function PwaBoot() {
  const { locale } = useLocale();
  const [isOnline, setIsOnline] = React.useState(true);
  const [installEvent, setInstallEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = React.useState(false);
  const [installing, setInstalling] = React.useState(false);
  const [updateReady, setUpdateReady] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshingRef = React.useRef(false);

  React.useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsOnline(window.navigator.onLine);
    setInstallDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");

    let unregisterListeners: (() => void) | undefined;

    if ("serviceWorker" in navigator) {
      const registerWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          if (registration.waiting) {
            setUpdateReady(true);
          }

          const handleUpdateFound = () => {
            const nextWorker = registration.installing;
            if (!nextWorker) {
              return;
            }

            nextWorker.addEventListener("statechange", () => {
              if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(true);
              }
            });
          };

          registration.addEventListener("updatefound", handleUpdateFound);
          unregisterListeners = () => registration.removeEventListener("updatefound", handleUpdateFound);
        } catch {
          return;
        }
      };

      void registerWorker();
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleBeforeInstallPrompt = (event: Event) => {
      if (isStandalone() || window.localStorage.getItem(DISMISS_KEY) === "1") {
        return;
      }

      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallEvent(null);
      window.localStorage.removeItem(DISMISS_KEY);
    };
    const handleControllerChange = () => {
      if (!refreshingRef.current) {
        setRefreshing(true);
        window.location.reload();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleInstalled);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    return () => {
      unregisterListeners?.();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleInstalled);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) {
      return;
    }

    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome !== "accepted") {
        window.localStorage.setItem(DISMISS_KEY, "1");
        setInstallDismissed(true);
      }
      setInstallEvent(null);
    } finally {
      setInstalling(false);
    }
  }

  function handleDismissInstall() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setInstallDismissed(true);
    setInstallEvent(null);
  }

  const showInstallPrompt = Boolean(installEvent) && !installDismissed && !isStandalone();

  async function handleRefreshApp() {
    if (!("serviceWorker" in navigator)) {
      window.location.reload();
      return;
    }

    setRefreshing(true);
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }

    window.location.reload();
  }

  return (
    <>
      {!isOnline ? (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-[130] rounded-[22px] border border-amber-400/30 bg-[var(--bg-glass-strong)] px-4 py-3 text-sm shadow-[var(--shadow-xl)] backdrop-blur-2xl sm:inset-x-auto sm:start-4 sm:bottom-4 sm:w-[22rem]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-300">
              <WifiOff className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-text-primary">{tx(locale, "أنت غير متصل الآن", "You are offline now")}</div>
              <div className="mt-1 text-xs leading-6 text-text-secondary">
                {tx(
                  locale,
                  "الواجهة والقوائم المخزنة ستظل متاحة، لكن أي حفظ أو إرسال يحتاج الاتصال.",
                  "Cached screens stay available, but saving and sending actions still need a connection.",
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showInstallPrompt ? (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-[130] rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-glass-strong)] p-4 shadow-[var(--shadow-xl)] backdrop-blur-2xl sm:inset-x-auto sm:start-4 sm:bottom-4 sm:w-[24rem]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--primary-400)]">
                <Download className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="font-bold text-text-primary">
                  {tx(locale, "ثبّت Tayyar على الموبايل", "Install Tayyar on your phone")}
                </div>
                <div className="mt-1 text-xs leading-6 text-text-secondary">
                  {tx(
                    locale,
                    "الوصول يصبح أسرع ويظهر التطبيق كواجهة مستقلة على الشاشة الرئيسية.",
                    "Launch faster and open it like a standalone app from the home screen.",
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissInstall}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-text-secondary"
              aria-label={tx(locale, "إغلاق", "Dismiss")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="gold" size="sm" loading={installing} onClick={() => void handleInstall()}>
              {tx(locale, "تثبيت الآن", "Install now")}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDismissInstall}>
              {tx(locale, "لاحقًا", "Later")}
            </Button>
          </div>
        </div>
      ) : null}

      {updateReady ? (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] z-[130] rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-glass-strong)] p-4 shadow-[var(--shadow-xl)] backdrop-blur-2xl sm:inset-x-auto sm:end-4 sm:bottom-4 sm:w-[24rem]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--primary-400)]">
              <Download className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-bold text-text-primary">
                {tx(locale, "في تحديث جديد جاهز", "A fresh update is ready")}
              </div>
              <div className="mt-1 text-xs leading-6 text-text-secondary">
                {tx(
                  locale,
                  "حدّث التطبيق الآن عشان تاخد آخر إصلاحات الموبايل والشاشات الجديدة.",
                  "Refresh now to load the latest mobile fixes and screen updates.",
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="gold" size="sm" loading={refreshing} onClick={() => void handleRefreshApp()}>
              {tx(locale, "تحديث التطبيق", "Refresh app")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setUpdateReady(false)}>
              {tx(locale, "لاحقاً", "Later")}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
