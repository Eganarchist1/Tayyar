"use client";

import React from "react";
import { Building2, Globe2, Mail, Phone, Settings, Wallet } from "lucide-react";
import { Card, PageHeader, PageShell, StatCard, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDate } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";
import AccountSecurityCard from "@/components/auth/AccountSecurityCard";

type SettingsPayload = {
  brand: {
    id: string;
    name: string;
    nameAr?: string | null;
    walletBalance: number;
    isActive: boolean;
    createdAt: string;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    language: string;
  };
  branches: Array<{ id: string; name: string; nameAr?: string | null; address: string; phone?: string | null }>;
  contract?: {
    id: string;
    type: string;
    value: number;
    currency: string;
    validFrom: string;
    validUntil?: string | null;
  } | null;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) => (locale === "ar" ? ar || en || "--" : en || ar || "--");

export default function MerchantSettingsPage() {
  const { locale } = useLocale();
  const [settings, setSettings] = React.useState<SettingsPayload | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch<SettingsPayload>("/v1/merchants/settings")
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "الإعدادات", en: "Settings" }}
      pageSubtitle={{ ar: "بيانات المتجر والحساب والتعاقد.", en: "Store, account, and contract details." }}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "إعدادات المتجر", en: "Store settings" }}
          title={{ ar: "بيانات المتجر والحساب", en: "Store and account data" }}
          subtitle={{ ar: "راجع بيانات المتجر والمالك والتعاقد والفروع من شاشة واحدة.", en: "Review brand, owner, contract, and branches from one screen." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "الإعدادات", en: "Settings" } },
          ]}
          chips={[
            { label: settings?.brand.isActive ? { ar: "الحساب نشط", en: "Account active" } : { ar: "الحساب موقوف", en: "Account inactive" }, tone: settings?.brand.isActive ? "success" : "gold" },
            { label: { ar: `لغة الحساب: ${settings?.owner.language || "ar"}`, en: `Account language: ${settings?.owner.language || "ar"}` }, tone: "neutral" },
          ]}
        />

        <section className="panel-grid">
          <StatCard label={tx(locale, "حالة المتجر", "Store status")} value={settings?.brand.isActive ? tx(locale, "نشط", "Active") : tx(locale, "معلق", "Suspended")} icon={<Building2 className="h-5 w-5" />} loading={loading} />
          <StatCard label={tx(locale, "عدد الفروع", "Branches")} value={settings?.branches.length ?? 0} icon={<Settings className="h-5 w-5" />} accentColor="primary" loading={loading} />
          <StatCard label={tx(locale, "الرصيد", "Balance")} value={settings?.brand.walletBalance ?? 0} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Wallet className="h-5 w-5" />} accentColor="gold" loading={loading} />
          <StatCard label={tx(locale, "لغة الحساب", "Account language")} value={settings?.owner.language || "ar"} icon={<Globe2 className="h-5 w-5" />} accentColor="success" loading={loading} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-6">
          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "بيانات العلامة التجارية", "Brand details")}</p>
              <h2 className="mt-2 text-2xl font-black">{pickLabel(locale, settings?.brand.nameAr, settings?.brand.name)}</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-xs text-text-tertiary">{tx(locale, "صاحب الحساب", "Account owner")}</div>
                <div className="mt-2 text-lg font-bold text-text-primary">{settings?.owner.name || "-"}</div>
                <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
                  <Mail className="h-4 w-4" />
                  {settings?.owner.email || "-"}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
                  <Phone className="h-4 w-4" />
                  {settings?.owner.phone || tx(locale, "غير مسجل", "Not set")}
                </div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-xs text-text-tertiary">{tx(locale, "التعاقد الفعال", "Active contract")}</div>
                <div className="mt-2 text-lg font-bold text-text-primary">{settings?.contract?.type || tx(locale, "غير محدد", "Not set")}</div>
                <div className="mt-2 text-sm text-text-secondary">
                  {settings?.contract
                    ? `${formatLocalizedCurrency(settings.contract.value, locale)} ${settings.contract.currency}`
                    : tx(locale, "لا يوجد عقد فعال حالياً.", "No active contract right now.")}
                </div>
                <div className="mt-2 text-xs text-text-tertiary">
                  {settings?.contract?.validFrom ? tx(locale, `من ${formatLocalizedDate(settings.contract.validFrom, locale)}`, `From ${formatLocalizedDate(settings.contract.validFrom, locale)}`) : ""}
                </div>
                <div className="mt-4">
                  <StatusPill label={settings?.contract ? { ar: "عقد نشط", en: "Active contract" } : { ar: "لا يوجد عقد", en: "No contract" }} tone={settings?.contract ? "success" : "gold"} />
                </div>
              </div>
            </div>
          </Card>
          <AccountSecurityCard />
          </div>

          <Card variant="elevated" className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "الفروع المربوطة", "Linked branches")}</p>
              <h2 className="mt-2 text-2xl font-black">{tx(locale, "نطاق التشغيل", "Operating footprint")}</h2>
            </div>
            <div className="space-y-3">
              {settings?.branches.map((branch) => (
                <div key={branch.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="font-bold text-text-primary">{pickLabel(locale, branch.nameAr, branch.name)}</div>
                  <div className="mt-1 text-sm text-text-secondary">{branch.address}</div>
                  <div className="mt-3 text-xs text-text-tertiary">{branch.phone || tx(locale, "لا يوجد رقم فرع", "No branch phone")}</div>
                </div>
              ))}
              {!loading && !settings?.branches.length ? (
                <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-8 text-sm text-text-secondary">
                  {tx(locale, "لا توجد فروع مرتبطة بالحساب.", "No branches are linked to this account.")}
                </div>
              ) : null}
            </div>
          </Card>
        </section>
      </div>
    </PageShell>
  );
}
