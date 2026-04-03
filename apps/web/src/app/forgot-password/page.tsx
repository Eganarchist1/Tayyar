"use client";

import React from "react";
import Link from "next/link";
import { Button, Card, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";

const tx = (locale: "ar" | "en", ar: string, en: string) =>
  locale === "ar" ? ar : en;

export default function ForgotPasswordPage() {
  const { locale } = useLocale();
  const [email, setEmail] = React.useState("admin@tayyar.app");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [resetUrl, setResetUrl] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setResetUrl(null);
    try {
      const payload = await apiFetch<{ resetUrl?: string }>(
        "/v1/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMessage(
        tx(
          locale,
          "لو الحساب موجود، اتبعت له وصلة تغيير كلمة المرور.",
          "If the account exists, a reset link was sent.",
        ),
      );
      setResetUrl(payload.resetUrl || null);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : tx(locale, "تعذر تنفيذ الطلب.", "Could not complete the request."),
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
            {tx(locale, "استرجاع كلمة المرور", "Reset password")}
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="app-font-body text-sm font-bold text-text-secondary">
              {tx(locale, "البريد الإلكتروني", "Email")}
            </label>
            <input
              className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <Button type="submit" fullWidth size="lg" loading={loading}>
            {tx(locale, "إرسال الوصلة", "Send link")}
          </Button>
        </form>

        {message ? (
          <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
            {message}
            {resetUrl ? (
              <div className="mt-3 break-all text-primary-300">
                <Link href={resetUrl}>{resetUrl}</Link>
              </div>
            ) : null}
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
