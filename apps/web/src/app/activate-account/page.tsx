"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import { getHomePathForRole, setStoredSession, type AppSession } from "@/lib/session";

const tx = (locale: "ar" | "en", ar: string, en: string) =>
  locale === "ar" ? ar : en;

function ActivateAccountPageContent() {
  const { locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleResend(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = await apiFetch<{ activationUrl?: string }>(
        "/v1/auth/resend-activation",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMessage(
        payload.activationUrl
          ? `${tx(locale, "تم تجهيز وصلة التفعيل:", "Activation link is ready:")} ${payload.activationUrl}`
          : tx(locale, "لو الحساب غير مفعل، اتبعت له وصلة تفعيل.", "If the account is inactive, an activation link was sent."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : tx(locale, "تعذر إرسال وصلة التفعيل.", "Could not send the activation link."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
      const payload = await apiFetch<AppSession>("/v1/auth/activate", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setStoredSession(payload);
      router.replace(getHomePathForRole(payload.user.role));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : tx(locale, "تعذر تفعيل الحساب.", "Could not activate the account."),
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
            {tx(locale, "تفعيل الحساب", "Activate account")}
          </div>
        </div>

        {token ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="app-font-body text-sm font-bold text-text-secondary">
                {tx(locale, "كلمة المرور", "Password")}
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
              {tx(locale, "تفعيل الحساب", "Activate account")}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleResend}>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
              {tx(
                locale,
                "إذا وصلة التفعيل مش معك، اكتب البريد وسنجهز وصلة جديدة.",
                "If you do not have the activation link, enter the email and a new one will be prepared.",
              )}
            </div>
            <div className="space-y-2">
              <label className="app-font-body text-sm font-bold text-text-secondary">
                {tx(locale, "البريد الإلكتروني", "Email")}
              </label>
              <input
                type="email"
                className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" fullWidth size="lg" loading={loading}>
              {tx(locale, "إرسال وصلة التفعيل", "Send activation link")}
            </Button>
          </form>
        )}

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

export default function ActivateAccountPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <ActivateAccountPageContent />
    </React.Suspense>
  );
}
