"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-canvas text-text-primary">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-10">
          <section className="w-full rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_32px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-text-tertiary">Platform error</p>
            <h1 className="mt-4 text-3xl font-black text-text-primary">The app hit a fatal error</h1>
            <p className="mt-3 text-sm text-text-secondary">Reset the app shell and try again.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-[18px] bg-primary-500 px-5 py-3 text-sm font-bold text-white"
              >
                Reset app
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-[18px] border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-text-primary"
              >
                Reload
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
