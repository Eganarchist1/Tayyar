"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Smartphone } from "lucide-react";
import { Button, Card, Input, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import { getHomePathForRole, getStoredSession, setStoredSession, type AppSession } from "@/lib/session";

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AppSession["user"];
};

type OtpRequestResponse = {
  sent: boolean;
  expiresInSeconds: number;
  phone: string;
  devCode?: string;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const [mode, setMode] = React.useState<"password" | "otp">("password");
  const [email, setEmail] = React.useState("admin@tayyar.app");
  const [password, setPassword] = React.useState("Tayyar@123");
  const [phone, setPhone] = React.useState("+201000000004");
  const [otp, setOtp] = React.useState("");
  const [devCode, setDevCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const nextPath = searchParams.get("next");

  React.useEffect(() => {
    const session = getStoredSession();
    if (session?.accessToken && session.user) {
      router.replace(nextPath || getHomePathForRole(session.user.role));
    }
  }, [nextPath, router]);

  async function finishAuth(payload: AuthResponse) {
    setStoredSession(payload);
    router.replace(nextPath || getHomePathForRole(payload.user.role));
  }

  async function handlePasswordLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = await apiFetch<AuthResponse>(
        "/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
        "ADMIN",
      );
      await finishAuth(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tx(locale, "تعذر تسجيل الدخول.", "Could not sign in."));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const payload = await apiFetch<OtpRequestResponse>(
        "/v1/auth/otp/request",
        {
          method: "POST",
          body: JSON.stringify({ phone }),
        },
        "HERO",
      );
      setDevCode(payload.devCode || "");
      setMessage(
        payload.devCode
          ? tx(locale, `تم إرسال الرمز. رمز الاختبار: ${payload.devCode}`, `Code sent. Test code: ${payload.devCode}`)
          : tx(locale, "تم إرسال الرمز.", "Code sent."),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tx(locale, "تعذر إرسال الرمز.", "Could not send the code."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setLoading(true);
    setMessage(null);
    try {
      const payload = await apiFetch<AuthResponse>(
        "/v1/auth/otp/verify",
        {
          method: "POST",
          body: JSON.stringify({ phone, code: otp }),
        },
        "HERO",
      );
      await finishAuth(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tx(locale, "الرمز غير صحيح.", "The code is invalid."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center py-10 px-4">
      {/* Dynamic Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(var(--primary-rgb),0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(var(--accent-rgb),0.08),transparent_35%)]" />

      <Card
        className="w-full max-w-md overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-glass-strong)] p-6 shadow-[var(--shadow-xl)] backdrop-blur-2xl sm:p-10"
        style={{ borderRadius: "32px" }}
      >
        <div className="mb-8 space-y-2 text-center mt-2">
          <div className="app-font-display text-4xl font-black text-[var(--text-primary)] tracking-tight">Tayyar</div>
          <div className="app-font-body text-sm font-medium text-[var(--text-secondary)]">
            {tx(locale, "تسجيل دخول المنصة", "Platform sign in")}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-1.5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`rounded-[18px] px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
              mode === "password"
                ? "bg-[var(--primary-500)] text-white shadow-[var(--shadow-card)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            {tx(locale, "إيميل وكلمة مرور", "Email & Password")}
          </button>
          <button
            type="button"
            onClick={() => setMode("otp")}
            className={`rounded-[18px] px-4 py-2.5 text-sm font-bold transition-all duration-300 ${
              mode === "otp"
                ? "bg-[var(--primary-500)] text-white shadow-[var(--shadow-card)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            {tx(locale, "رمز الهاتف", "Phone Code")}
          </button>
        </div>

        {mode === "password" ? (
          <form className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300" onSubmit={handlePasswordLogin}>
            <div className="space-y-2.5">
              <label htmlFor="login-email" className="app-font-body text-sm font-bold text-[var(--text-secondary)] ml-1">
                {tx(locale, "البريد الإلكتروني", "Email")}
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2.5">
              <label htmlFor="login-password" className="app-font-body text-sm font-bold text-[var(--text-secondary)] ml-1">
                {tx(locale, "كلمة المرور", "Password")}
              </label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm px-1 pt-1 pb-3">
              <Link href="/forgot-password" className="font-bold text-[var(--primary-600)] transition-colors hover:text-[var(--primary-700)] hover:underline underline-offset-4">
                {tx(locale, "نسيت كلمة المرور؟", "Forgot password?")}
              </Link>
              <Link href="/activate-account" className="font-bold text-[var(--primary-600)] transition-colors hover:text-[var(--primary-700)] hover:underline underline-offset-4">
                {tx(locale, "تفعيل حساب", "Activate account")}
              </Link>
            </div>
            <Button type="submit" fullWidth size="lg" loading={loading} icon={<KeyRound className="h-4 w-4" />}>
              {tx(locale, "المتابعة", "Continue")}
            </Button>
          </form>
        ) : (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <form className="space-y-5" onSubmit={handleRequestOtp}>
              <div className="space-y-2.5">
                <label htmlFor="login-phone" className="app-font-body text-sm font-bold text-[var(--text-secondary)] ml-1">
                  {tx(locale, "رقم الهاتف", "Phone number")}
                </label>
                <Input
                  id="login-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <Button type="submit" fullWidth size="lg" loading={loading} icon={<Smartphone className="h-4 w-4" />}>
                {tx(locale, "طلب رمز الدخول", "Request Code")}
              </Button>
            </form>

            <div className="space-y-2.5">
              <label htmlFor="login-otp" className="app-font-body text-sm font-bold text-[var(--text-secondary)] ml-1">
                {tx(locale, "رمز التحقق", "Verification code")}
              </label>
              <Input
                id="login-otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={tx(locale, "أدخل الرمز…", "Enter the code…")}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              />
            </div>
            {devCode ? (
              <div className="rounded-[18px] border border-[var(--primary-500)] bg-[var(--primary-500)] bg-opacity-10 px-4 py-3 text-sm text-[var(--primary-700)] font-medium">
                {tx(locale, "رمز الاختبار ظاهر أثناء التطوير.", "The test code is visible in development.")}
              </div>
            ) : null}
            <Button fullWidth size="lg" variant="gold" loading={loading} onClick={handleVerifyOtp} className="mt-2">
              {tx(locale, "تأكيد الرمز والمتابعة", "Verify Code & Continue")}
            </Button>
          </div>
        )}

        <div className="mt-8 space-y-3">
          {message ? (
            <div className="rounded-[18px] border border-[var(--gold-400)] bg-[var(--gold-500)] bg-opacity-10 px-4 py-3 text-sm text-[var(--gold-700)] font-medium text-center animate-in fade-in slide-in-from-top-1">
              {message}
            </div>
          ) : null}

          <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-xs text-center font-medium text-[var(--text-tertiary)]">
            {tx(
              locale,
              "حسابات الاختبار الافتراضية تستخدم كلمة المرور Tayyar@123.",
              "Default demo accounts use the password Tayyar@123.",
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-transparent" />}>
      <LoginPageContent />
    </React.Suspense>
  );
}
