"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpLeft, Package, Radar, Store, Wallet } from "lucide-react";
import { Button, Card, PageShell, StatCard, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDateTime } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type MerchantBootstrap = {
  brand: { id: string; name: string; nameAr?: string | null };
  branches: Array<{ id: string; name: string; nameAr?: string | null; address: string }>;
  zones: Array<{ id: string; name: string; nameAr: string; city: string; baseFee: number }>;
};

type MerchantBillingSnapshot = {
  brand: {
    id: string;
    name: string;
    nameAr?: string | null;
    walletBalance: number;
    isActive: boolean;
  };
  contract?: {
    value?: number | null;
  } | null;
  invoices: Array<{
    id: string;
    totalAmount: number;
    status: string;
    dueDate?: string | null;
  }>;
  transactions: Array<{ id: string; amount: number; createdAt: string; type: string }>;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

export default function MerchantDashboard() {
  const { locale, direction } = useLocale();
  const [boot, setBoot] = React.useState<MerchantBootstrap | null>(null);
  const [billing, setBilling] = React.useState<MerchantBillingSnapshot | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadDashboard = React.useCallback(() => {
    Promise.allSettled([
      apiFetch<MerchantBootstrap>("/v1/merchants/bootstrap"),
      apiFetch<MerchantBillingSnapshot>("/v1/merchants/invoices"),
    ]).then(([bootResult, billingResult]) => {
      if (bootResult.status === "fulfilled") setBoot(bootResult.value);
      if (billingResult.status === "fulfilled") setBilling(billingResult.value);
      setLoading(false);
    });
  }, []);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      loadDashboard();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const baseFeeAvg = boot?.zones.length
    ? Math.round(boot.zones.reduce((sum, zone) => sum + zone.baseFee, 0) / boot.zones.length)
    : 0;

  const latestInvoice = billing?.invoices[0] || null;
  const latestTransaction = billing?.transactions[0] || null;

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "لوحة التحكم", en: "Dashboard" }}
      pageSubtitle={{ ar: "الطلبات والرصيد والفروع.", en: "Orders, balance, and branches." }}
      showLive
      topbarActions={
        <>
          <Link href="/merchant/wallet">
            <Button variant="secondary" size="sm" icon={<Wallet className="h-4 w-4" />}>
              {tx(locale, "الفواتير والرصيد", "Billing")}
            </Button>
          </Link>
          <Link href="/merchant/orders/new">
            <Button variant="gold" size="sm" icon={<Package className="h-4 w-4" />}>
              {tx(locale, "طلب جديد", "New order")}
            </Button>
          </Link>
        </>
      }
    >
      <div className="space-y-8">
        <section className="panel-grid">
          <StatCard
            label={{ ar: "الفروع", en: "Branches" }}
            value={boot?.branches.length ?? 0}
            icon={<Store className="h-5 w-5" />}
            loading={loading}
          />
          <StatCard
            label={{ ar: "المناطق", en: "Zones" }}
            value={boot?.zones.length ?? 0}
            icon={<Radar className="h-5 w-5" />}
            accentColor="gold"
            loading={loading}
          />
          <StatCard
            label={{ ar: "متوسط الرسوم", en: "Average fee" }}
            value={baseFeeAvg}
            suffix={locale === "ar" ? "ج.م" : "EGP"}
            icon={<Package className="h-5 w-5" />}
            accentColor="success"
            loading={loading}
          />
          <StatCard
            label={{ ar: "الرصيد الحالي", en: "Current balance" }}
            value={billing?.brand.walletBalance ?? 0}
            suffix={locale === "ar" ? "ج.م" : "EGP"}
            icon={<Wallet className="h-5 w-5" />}
            accentColor="primary"
            loading={loading}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <Card variant="elevated" className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="subtle-label">{tx(locale, "الإجراءات السريعة", "Quick actions")}</p>
                <h2 className="text-2xl font-black text-[var(--text-primary)]">
                  {tx(locale, "ابدأ من الإجراء المطلوب مباشرة", "Start from the action you need")}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                  {tx(
                    locale,
                    "أنشئ طلبا جديدا، راجع الفواتير، أو افتح الفروع من نفس الشاشة.",
                    "Create a new order, review billing, or open branch records from the same screen.",
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card padding="sm" className="border-[var(--border-default)] bg-[var(--bg-surface-2)]">
                <p className="subtle-label">{tx(locale, "الطلبات", "Orders")}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">
                  {tx(locale, "إنشاء طلب جديد", "Create a new order")}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {tx(
                    locale,
                    "ابدأ برقم العميل ثم اختر العنوان وحالة الدفع.",
                    "Start with the customer phone, then choose the address and payment status.",
                  )}
                </p>
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--primary-600)] hover:underline dark:text-[var(--primary-400)]"
                  href="/merchant/orders/new"
                >
                  {tx(locale, "فتح الطلب الجديد", "Open new order")}
                  <ArrowUpLeft className="h-4 w-4" />
                </Link>
              </Card>

              <Card padding="sm" className="border-[var(--border-default)] bg-[var(--bg-surface-2)]">
                <p className="subtle-label">{tx(locale, "المالية", "Billing")}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">
                  {tx(locale, "الفواتير والرصيد", "Billing and balance")}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {tx(
                    locale,
                    "راجع الرصيد والحركات والفواتير من صفحة واحدة.",
                    "Review balance, transactions, and invoices in one place.",
                  )}
                </p>
                <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                  <div>
                    {tx(locale, "الرصيد", "Balance")}:{" "}
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {formatLocalizedCurrency(billing?.brand.walletBalance ?? 0, locale)}
                    </span>
                  </div>
                  <div>
                    {tx(locale, "آخر فاتورة", "Latest invoice")}:{" "}
                    <span className="font-bold text-[var(--text-primary)]">
                      {latestInvoice
                        ? `${formatLocalizedCurrency(latestInvoice.totalAmount, locale)} - ${latestInvoice.status}`
                        : tx(locale, "لا توجد", "None")}
                    </span>
                  </div>
                  <div>
                    {tx(locale, "آخر حركة", "Latest transaction")}:{" "}
                    <span className="font-bold text-[var(--text-primary)]">
                      {latestTransaction ? formatLocalizedDateTime(latestTransaction.createdAt, locale) : tx(locale, "لا توجد", "None")}
                    </span>
                  </div>
                </div>
                <Link
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--primary-600)] hover:underline dark:text-[var(--primary-400)]"
                  href="/merchant/wallet"
                >
                  {tx(locale, "افتح الرصيد والحركات", "Open wallet and ledger")}
                  <ArrowUpLeft className="h-4 w-4" />
                </Link>
              </Card>

              <Card padding="sm" className="border-[var(--border-default)] bg-[var(--bg-surface-2)]">
                <p className="subtle-label">{tx(locale, "الفروع", "Branches")}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">
                  {tx(locale, "راجع الفروع", "Review branches")}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {tx(locale, "تأكد من بيانات الفروع قبل ضغط التشغيل.", "Check branch records before peak operations.")}
                </p>
                <div className="mt-4 text-sm font-bold text-[var(--text-secondary)]">
                  {locale === "ar"
                    ? boot?.branches[0]?.nameAr || boot?.branches[0]?.name || "لا يوجد فرع مسجل"
                    : boot?.branches[0]?.name || boot?.branches[0]?.nameAr || "No branch on file"}
                </div>
              </Card>
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "المناطق والحساب", "Zones and billing")}</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">
                {tx(locale, "التغطية وملخص الحساب", "Coverage and billing snapshot")}
              </h2>
            </div>

            <div className="space-y-3">
              <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">{tx(locale, "حالة الحساب", "Account status")}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      {billing?.brand.isActive === false
                        ? tx(locale, "الحساب غير نشط", "Merchant account is inactive")
                        : tx(locale, "الحساب جاهز للتشغيل", "Merchant account is ready")}
                    </div>
                  </div>
                  <StatusPill
                    label={billing?.brand.isActive === false ? { ar: "غير نشط", en: "Inactive" } : { ar: "نشط", en: "Active" }}
                    tone={billing?.brand.isActive === false ? "gold" : "success"}
                  />
                </div>

                <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between gap-3">
                    <span>{tx(locale, "عدد الفواتير", "Invoice count")}</span>
                    <span className="font-bold text-[var(--text-primary)]">{billing?.invoices.length ?? 0}</span>
                  </div>
                  {billing?.contract?.value ? (
                    <div className="flex items-center justify-between gap-3">
                      <span>{tx(locale, "قيمة التعاقد", "Contract value")}</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {formatLocalizedCurrency(billing.contract.value, locale)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {boot?.zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-4"
                >
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">
                      {locale === "ar" ? zone.nameAr || zone.name : zone.name || zone.nameAr}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">{zone.city}</div>
                  </div>
                  <div style={{ textAlign: direction === "rtl" ? "right" : "left" }}>
                    <div className="text-sm font-mono font-bold text-[var(--success-600)] dark:text-[var(--success-400)]">
                      {formatLocalizedCurrency(zone.baseFee, locale)}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "رسوم البداية", "Base fee")}</div>
                  </div>
                </div>
              ))}

              {!loading && !boot?.zones.length ? (
                <div className="rounded-[22px] border border-dashed border-[var(--border-default)] px-4 py-6 text-sm text-[var(--text-secondary)]">
                  {tx(locale, "لا توجد مناطق مفعلة حاليا.", "No active zones right now.")}
                </div>
              ) : null}
            </div>
          </Card>
        </section>
      </div>
    </PageShell>
  );
}
