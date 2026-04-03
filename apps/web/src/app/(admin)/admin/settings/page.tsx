"use client";

import React from "react";
import { Globe2, Settings, ShieldCheck, Users } from "lucide-react";
import { Card, PageHeader, PageShell, StatCard, StatusPill, text, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import AccountSecurityCard from "@/components/auth/AccountSecurityCard";

type SettingsOverview = {
  locale: string;
  defaultTheme: string;
  websocketEnabled: boolean;
  devMode: boolean;
  transports?: {
    smtpConfigured: boolean;
    otpDeliveryMode: string;
    whatsappConfigured: boolean;
  };
  stats: {
    users: number;
    zones: number;
    activeHeroes: number;
    merchants: number;
  };
  policies: Array<{ key: string; labelAr: string; enabled: boolean }>;
};

const copy = {
  title: text("الإعدادات", "Settings"),
  subtitle: text("إعدادات المنصة الأساسية.", "Core platform settings."),
  header: text("إعدادات المنصة", "Platform settings"),
  headerTitle: text("حالة المنصة والسياسات", "Platform state and policies"),
  headerBody: text("راجع اللغة والسمة والسياسات الأساسية من شاشة واحدة.", "Review locale, theme, and core policies from one screen."),
  users: text("المستخدمون", "Users"),
  zones: text("المناطق", "Zones"),
  activeHeroes: text("الطيارون النشطون", "Active heroes"),
  merchants: text("التجار", "Merchants"),
  defaultLocale: text("اللغة الافتراضية", "Default locale"),
  policies: text("السياسات", "Policies"),
  capabilities: text("قدرات المنصة", "Platform capabilities"),
  transports: text("قنوات الإرسال", "Delivery channels"),
  smtpReady: text("البريد مفعل", "SMTP ready"),
  smtpMissing: text("البريد غير مفعل", "SMTP not configured"),
  whatsappReady: text("واتساب مفعل", "WhatsApp ready"),
  whatsappMissing: text("واتساب غير مفعل", "WhatsApp not configured"),
  realtimeOn: text("البث المباشر مفعل", "Realtime enabled"),
  realtimeOff: text("البث المباشر متوقف", "Realtime disabled"),
  devOn: text("وضع التطوير مفعل", "Dev mode enabled"),
  devOff: text("وضع التطوير متوقف", "Dev mode disabled"),
  enabled: text("مفعل", "Enabled"),
  disabled: text("متوقف", "Disabled"),
};

export default function AdminSettingsPage() {
  const { locale, t } = useLocale();
  const [settings, setSettings] = React.useState<SettingsOverview | null>(null);

  React.useEffect(() => {
    apiFetch<SettingsOverview>("/v1/admin/settings/overview", undefined, "ADMIN").then(setSettings);
  }, []);

  return (
    <PageShell
      role="ADMIN"
      user={{ name: text("مدير المنصة", "Platform admin"), email: "admin@tayyar.app" }}
      pageTitle={copy.title}
      pageSubtitle={copy.subtitle}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={copy.header}
          title={copy.headerTitle}
          subtitle={copy.headerBody}
          breadcrumbs={[
            { label: text("الإدارة", "Admin"), href: "/admin" },
            { label: copy.title },
          ]}
        />

        <section className="panel-grid">
          <StatCard label={copy.users} value={settings?.stats.users ?? 0} icon={<Users className="h-5 w-5" />} />
          <StatCard label={copy.zones} value={settings?.stats.zones ?? 0} icon={<Settings className="h-5 w-5" />} accentColor="primary" />
          <StatCard label={copy.activeHeroes} value={settings?.stats.activeHeroes ?? 0} icon={<ShieldCheck className="h-5 w-5" />} accentColor="success" />
          <StatCard label={copy.merchants} value={settings?.stats.merchants ?? 0} icon={<Globe2 className="h-5 w-5" />} accentColor="gold" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
          <Card variant="elevated" className="space-y-4">
            <div className="text-sm text-text-secondary">{t(copy.defaultLocale)}</div>
            <div className="text-3xl font-black text-text-primary">{settings?.locale || "ar-EG"}</div>
            <div className="grid gap-3">
              <StatusPill label={{ ar: `السمة: ${settings?.defaultTheme || "midnight"}`, en: `Theme: ${settings?.defaultTheme || "midnight"}` }} tone="primary" />
              <StatusPill label={settings?.websocketEnabled ? copy.realtimeOn : copy.realtimeOff} tone={settings?.websocketEnabled ? "success" : "gold"} />
              <StatusPill label={settings?.devMode ? copy.devOn : copy.devOff} tone={settings?.devMode ? "gold" : "neutral"} />
              <StatusPill
                label={
                  settings?.transports?.smtpConfigured
                    ? copy.smtpReady
                    : copy.smtpMissing
                }
                tone={settings?.transports?.smtpConfigured ? "success" : "gold"}
              />
              <StatusPill
                label={
                  settings?.transports?.whatsappConfigured
                    ? copy.whatsappReady
                    : copy.whatsappMissing
                }
                tone={settings?.transports?.whatsappConfigured ? "success" : "gold"}
              />
              <StatusPill
                label={{
                  ar: `OTP: ${settings?.transports?.otpDeliveryMode || "DEV"}`,
                  en: `OTP: ${settings?.transports?.otpDeliveryMode || "DEV"}`,
                }}
                tone="primary"
              />
            </div>
          </Card>
          <AccountSecurityCard />
          </div>

          <Card className="space-y-4">
            <div>
              <p className="subtle-label">{t(copy.policies)}</p>
              <h2 className="mt-2 text-2xl font-black">{t(copy.capabilities)}</h2>
            </div>
            <div className="grid gap-3">
              {settings?.policies.map((policy) => (
                <div key={policy.key} className="flex items-center justify-between gap-4 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4">
                  <div className="font-bold text-text-primary">{locale === "ar" ? policy.labelAr : policy.key.replace(/_/g, " ")}</div>
                  <StatusPill label={policy.enabled ? copy.enabled : copy.disabled} tone={policy.enabled ? "success" : "gold"} />
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PageShell>
  );
}
