"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import { getHomePathForRole, setStoredSession, type AppSession } from "@/lib/session";

const tx = (locale: "ar" | "en", ar: string, en: string) =>
  locale === "ar" ? ar : en;

function ResetPasswordPageContent() {
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) {
      setMessage(tx(locale, "وصلة التغيير غير صحيحة.", "The reset link is invalid."));
      return;
    }
    if (password.length < 8) {
      setMessage(tx(locale, "كلمة المرور لازم تكون 8 أحرف أو أكثر.", "Password must be at least 8 characters."));
      return;
    }
    if (password !== confirmPassword) {
      setMessage(tx(locale, "كلمتا المرور غير متطابقتين.", "Passwords do not match."));
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const payload = await apiFetch<AppSession>("/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setStoredSession(payload);
      router.replace(getHomePathForRole(payload.user.role));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : tx(locale, "تعذر تغيير كلمة المرور.", "Could not reset the password."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card variant="elevated" className="w-full max-w-lg space-y-6">
        <div className="space-y-2 text-center">
          <div className="app-font-display text-4xl font-black text-text-primary">
            Tayyar
          </div>
          <div className="app-font-body text-sm text-text-secondary">
            {tx(locale, "تغيير كلمة المرور", "Choose a new password")}
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="app-font-body text-sm font-bold text-text-secondary">
              {tx(locale, "كلمة المرور الجديدة", "New password")}
            </label>
            <input
              type="password"
              className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="app-font-body text-sm font-bold text-text-secondary">
              {tx(locale, "تأكيد كلمة المرور", "Confirm password")}
            </label>
            <input
              type="password"
              className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <Button type="submit" fullWidth size="lg" loading={loading}>
            {tx(locale, "حفظ والدخول", "Save and sign in")}
          </Button>
        </form>

        {message ? (
          <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
            {message}
          </div>
        ) : null}

        <div className="text-center text-sm text-text-secondary">
          <Link href="/login" className="font-bold text-primary-300">
            {tx(locale, "الرجوع لتسجيل الدخول", "Back to sign in")}
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <ResetPasswordPageContent />
    </React.Suspense>
  );
}
