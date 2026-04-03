"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import { setStoredSession, signOutStoredSession, type AppSession } from "@/lib/session";

const tx = (locale: "ar" | "en", ar: string, en: string) =>
  locale === "ar" ? ar : en;

export default function AccountSecurityCard() {
  const { locale } = useLocale();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [nextPassword, setNextPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    if (nextPassword.length < 8) {
      setMessage(
        tx(
          locale,
          "كلمة المرور الجديدة لازم تكون 8 أحرف أو أكثر.",
          "The new password must be at least 8 characters.",
        ),
      );
      return;
    }
    if (nextPassword !== confirmPassword) {
      setMessage(tx(locale, "كلمتا المرور غير متطابقتين.", "Passwords do not match."));
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = await apiFetch<AppSession>("/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          nextPassword,
        }),
      });
      setStoredSession(payload);
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setMessage(tx(locale, "تم تغيير كلمة المرور.", "Password updated."));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : tx(locale, "تعذر تغيير كلمة المرور.", "Could not change the password."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOutStoredSession();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Card variant="elevated" className="space-y-5">
      <div>
        <p className="subtle-label">{tx(locale, "أمان الحساب", "Account security")}</p>
        <h2 className="mt-2 text-2xl font-black">
          {tx(locale, "كلمة المرور وتسجيل الخروج", "Password and sign out")}
        </h2>
      </div>

      <form className="space-y-4" onSubmit={handleChangePassword}>
        <input
          type="password"
          className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4"
          placeholder={tx(locale, "كلمة المرور الحالية", "Current password")}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
        <input
          type="password"
          className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4"
          placeholder={tx(locale, "كلمة المرور الجديدة", "New password")}
          value={nextPassword}
          onChange={(event) => setNextPassword(event.target.value)}
          required
        />
        <input
          type="password"
          className="h-12 w-full rounded-[18px] border border-white/10 bg-white/[0.04] px-4"
          placeholder={tx(locale, "تأكيد كلمة المرور", "Confirm password")}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        <div className="grid gap-3 md:grid-cols-2">
          <Button type="submit" variant="gold" fullWidth loading={saving}>
            {tx(locale, "حفظ كلمة المرور", "Save password")}
          </Button>
          <Button
            type="button"
            variant="outline"
            fullWidth
            loading={loggingOut}
            onClick={handleLogout}
          >
            {tx(locale, "تسجيل الخروج", "Sign out")}
          </Button>
        </div>
      </form>

      {message ? (
        <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-text-secondary">
          {message}
        </div>
      ) : null}
    </Card>
  );
}
