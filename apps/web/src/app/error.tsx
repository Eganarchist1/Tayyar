"use client";

import React from "react";
import { text } from "@tayyar/ui";

function detectLocale() {
  if (typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("en")) {
    return "en" as const;
  }
  return "ar" as const;
}

const copy = {
  eyebrow: text("خطأ في الواجهة", "Client error"),
  title: text("حصل خطأ أثناء فتح الصفحة", "Something went wrong while loading this page"),
  description: text("حدّث الصفحة أو جرّب مرة تانية. لو المشكلة مستمرة، راجع السجل الفني.", "Refresh the page or try again. If it keeps happening, check the client logs."),
  retry: text("إعادة المحاولة", "Try again"),
  reload: text("تحديث الصفحة", "Reload page"),
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = React.useState<"ar" | "en">("ar");

  React.useEffect(() => {
    setLocale(detectLocale());
    console.error(error);
  }, [error]);

  const isArabic = locale === "ar";
  const pick = (value: { ar: string; en: string }) => (isArabic ? value.ar : value.en);

  return (
    <html lang={isArabic ? "ar-EG" : "en"} dir={isArabic ? "rtl" : "ltr"}>
      <body className="min-h-screen bg-canvas text-text-primary">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-10">
          <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_32px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-text-tertiary">{pick(copy.eyebrow)}</p>
            <h1 className="mt-4 text-3xl font-black text-text-primary">{pick(copy.title)}</h1>
            <p className="mt-3 text-sm text-text-secondary">{pick(copy.description)}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => reset()} className="rounded-[18px] bg-primary-500 px-5 py-3 text-sm font-bold text-white">
                {pick(copy.retry)}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-[18px] border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-text-primary"
              >
                {pick(copy.reload)}
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
