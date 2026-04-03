"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, Archive, Building2, Phone, RefreshCcw, Save, Store, Wallet } from "lucide-react";
import { Button, Card, EmptyStateCard, Input, PageHeader, PageShell, StatusPill, useLocale } from "@tayyar/ui";
import type { AdminMerchantDetail } from "@tayyar/types";
import { apiFetch } from "@/lib/api";
import { auditSummaryLine, localizeAlertMessage, localizeAlertTitle, localizeAuditAction } from "@/lib/ops";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function formatCurrency(amount: number, locale: "ar" | "en") {
  return locale === "ar" ? `${amount.toFixed(0)} ج.م` : `EGP ${amount.toFixed(0)}`;
}

function formatDate(value: string, locale: "ar" | "en") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminMerchantDetailPage() {
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const [merchant, setMerchant] = React.useState<AdminMerchantDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    nameAr: "",
    ownerName: "",
    ownerPhone: "",
    logoUrl: "",
    isActive: true,
  });

  const loadMerchant = React.useCallback(async () => {
    if (!params?.id) return;
    const data = await apiFetch<AdminMerchantDetail>(`/v1/admin/merchants/${params.id}`, undefined, "ADMIN");
    setMerchant(data);
    setForm({
      name: data.name,
      nameAr: data.nameAr || "",
      ownerName: data.owner.name,
      ownerPhone: data.owner.phone || "",
      logoUrl: data.logoUrl || "",
      isActive: data.isActive,
    });
  }, [params?.id]);

  React.useEffect(() => {
    loadMerchant()
      .catch((err) => setError(err instanceof Error ? err.message : tx(locale, "تعذر تحميل بيانات التاجر.", "Could not load merchant record.")))
      .finally(() => setLoading(false));
  }, [loadMerchant, locale]);

  React.useEffect(() => {
    if (!merchant) {
      return;
    }

    const interval = window.setInterval(() => {
      setRefreshing(true);
      loadMerchant().finally(() => setRefreshing(false));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadMerchant, merchant]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!params?.id) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const data = await apiFetch<AdminMerchantDetail>(
        `/v1/admin/merchants/${params.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
        "ADMIN",
      );
      setMerchant(data);
      setMessage(tx(locale, "تم حفظ بيانات التاجر.", "Merchant record saved."));
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر حفظ بيانات التاجر.", "Could not save merchant changes."));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!params?.id || !merchant) return;
    setArchiving(true);
    setError(null);
    setMessage(null);

    try {
      const data = await apiFetch<AdminMerchantDetail>(
        `/v1/admin/merchants/${params.id}/archive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: merchant.isActive }),
        },
        "ADMIN",
      );
      setMerchant(data);
      setForm((current) => ({ ...current, isActive: data.isActive }));
      setMessage(
        data.isActive
          ? tx(locale, "تمت إعادة تفعيل التاجر.", "Merchant restored.")
          : tx(locale, "تمت أرشفة التاجر ومنع تشغيله الجديد.", "Merchant archived and blocked from new operations."),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر تحديث حالة التاجر.", "Could not update merchant state."));
    } finally {
      setArchiving(false);
    }
  }

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "ملف التاجر", en: "Merchant record" }}
      pageSubtitle={{ ar: "تحكم كامل في بيانات التاجر والفروع والحالة التشغيلية.", en: "Full control over merchant info, branches, and operating status." }}
      showLive
      topbarActions={
        merchant ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => {
              setRefreshing(true);
              loadMerchant().finally(() => setRefreshing(false));
            }} loading={refreshing}>
              {tx(locale, "تحديث", "Refresh")}
            </Button>
            <Link href={`/admin/finance?merchantId=${merchant.id}`}>
              <Button variant="secondary" size="sm" icon={<Wallet className="h-4 w-4" />}>
                {tx(locale, "المالية", "Finance")}
              </Button>
            </Link>
            <Link href={`/admin/reports?merchantId=${merchant.id}`}>
              <Button variant="secondary" size="sm" icon={<ArrowUpRight className="h-4 w-4" />}>
                {tx(locale, "التقارير", "Reports")}
              </Button>
            </Link>
            <Button
              variant={merchant.isActive ? "outline" : "secondary"}
              size="sm"
              icon={<Archive className="h-4 w-4" />}
              onClick={handleArchiveToggle}
              loading={archiving}
            >
              {merchant.isActive ? tx(locale, "أرشفة التاجر", "Archive merchant") : tx(locale, "إعادة التفعيل", "Reactivate merchant")}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "ملف التاجر", en: "Merchant record" }}
          title={{ ar: merchant?.nameAr || merchant?.name || "تفاصيل التاجر", en: merchant?.name || "Merchant details" }}
          subtitle={{ ar: "من هنا تعدّل البيانات الأساسية وتراجع الفروع والمالية والتنبيهات بسرعة.", en: "Edit core data and review branches, finance, and alerts from one place." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/admin" },
            { label: { ar: "التجار", en: "Merchants" }, href: "/admin/merchants" },
            { label: { ar: "ملف التاجر", en: "Merchant record" } },
          ]}
          chips={merchant ? [
            { label: { ar: merchant.isActive ? "شغال" : "مؤرشف", en: merchant.isActive ? "Active" : "Archived" }, tone: merchant.isActive ? "success" : "gold" },
            { label: { ar: `${merchant.stats.branches} فرع`, en: `${merchant.stats.branches} branches` }, tone: "primary" },
          ] : undefined}
        />

        {message ? <Card className="border border-emerald-500/20 bg-emerald-500/10 text-sm text-emerald-100">{message}</Card> : null}
        {error ? <Card className="border border-danger-500/20 bg-danger-500/10 text-sm text-red-100">{error}</Card> : null}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
          </div>
        ) : null}

        {!loading && !merchant ? (
          <EmptyStateCard
            title={{ ar: "ملف التاجر غير موجود", en: "Merchant record not found" }}
            description={{ ar: "ممكن يكون اتحذف أو الرابط غير صحيح.", en: "The record may have been removed or the link is invalid." }}
          />
        ) : null}

        {!loading && merchant ? (
          <form className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]" onSubmit={handleSave}>
            <Card variant="elevated" className="space-y-5">
              <div>
                <p className="subtle-label">{tx(locale, "البيانات الأساسية", "Core data")}</p>
                <h2 className="mt-2 text-2xl font-black">{tx(locale, "عدّل بيانات التاجر بسرعة", "Update merchant details fast")}</h2>
              </div>

              <Input placeholder={tx(locale, "اسم التاجر بالإنجليزية", "Merchant name")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              <Input placeholder={tx(locale, "اسم التاجر بالعربي", "Merchant Arabic name")} value={form.nameAr} onChange={(event) => setForm((current) => ({ ...current, nameAr: event.target.value }))} />
              <Input placeholder={tx(locale, "اسم صاحب الحساب", "Owner name")} value={form.ownerName} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} />
              <Input placeholder={tx(locale, "رقم صاحب الحساب", "Owner phone")} value={form.ownerPhone} onChange={(event) => setForm((current) => ({ ...current, ownerPhone: event.target.value }))} />
              <Input placeholder={tx(locale, "رابط اللوجو", "Logo URL")} value={form.logoUrl} onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))} />

              <label className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-text-primary">
                <span>{tx(locale, "التاجر شغال على المنصة", "Merchant is active on the platform")}</span>
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 accent-sky-500" />
              </label>

              <Button type="submit" variant="gold" size="lg" fullWidth loading={saving} icon={<Save className="h-4 w-4" />}>
                {tx(locale, "حفظ التعديلات", "Save changes")}
              </Button>
            </Card>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-primary-500/12 text-primary-200"><Store className="h-5 w-5" /></div>
                  <div className="text-xs text-text-tertiary">{tx(locale, "الفروع", "Branches")}</div>
                  <div className="font-mono text-2xl font-black">{merchant.stats.branches}</div>
                </Card>
                <Card className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-accent-500/12 text-amber-200"><Building2 className="h-5 w-5" /></div>
                  <div className="text-xs text-text-tertiary">{tx(locale, "العملاء", "Customers")}</div>
                  <div className="font-mono text-2xl font-black">{merchant.stats.customers}</div>
                </Card>
                <Card className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-emerald-500/12 text-emerald-300"><Wallet className="h-5 w-5" /></div>
                  <div className="text-xs text-text-tertiary">{tx(locale, "الرصيد", "Balance")}</div>
                  <div className="font-mono text-xl font-black">{formatCurrency(merchant.walletBalance, locale)}</div>
                </Card>
              </div>

              <Card className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="subtle-label">{tx(locale, "الفروع", "Branches")}</p>
                    <h2 className="mt-2 text-2xl font-black">{tx(locale, "فروع التاجر", "Merchant branches")}</h2>
                  </div>
                  <Link href="/admin/branches" className="text-sm font-bold text-primary-300">
                    <span className="inline-flex items-center gap-2">{tx(locale, "كل الفروع", "All branches")}<ArrowUpRight className="h-4 w-4" /></span>
                  </Link>
                </div>

                <div className="space-y-3">
                  {merchant.branches.map((branch) => (
                    <Link key={branch.id} href={`/admin/branches/${branch.id}`} className="block rounded-[22px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-primary-500/20 hover:bg-primary-500/8">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-text-primary">{branch.nameAr || branch.name}</div>
                          <div className="mt-1 text-sm text-text-secondary">{branch.address}</div>
                        </div>
                        <StatusPill label={branch.isActive ? tx(locale, "شغال", "Active") : tx(locale, "مؤرشف", "Archived")} tone={branch.isActive ? "success" : "gold"} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-text-secondary">
                        <div>{tx(locale, "طلبات", "Orders")}: {branch.orderCount}</div>
                        <div>{tx(locale, "عملاء", "Customers")}: {branch.customerCount}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>

              <Card className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="subtle-label">{tx(locale, "الملف المالي", "Finance case")}</p>
                    <h2 className="mt-2 text-2xl font-black">{tx(locale, "المالية والتقارير", "Finance and reports")}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/finance?merchantId=${merchant.id}`}>
                      <Button variant="secondary" size="sm">{tx(locale, "فتح المالية", "Open finance")}</Button>
                    </Link>
                    <Link href={`/admin/reports?merchantId=${merchant.id}`}>
                      <Button variant="secondary" size="sm">{tx(locale, "فتح التقارير", "Open reports")}</Button>
                    </Link>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm text-text-secondary">
                  {tx(locale, "من هنا تراجع حالة التسوية الخاصة بالتاجر وتصدر ملفاته بشكل منفصل حسب التاريخ.", "From here you can review the merchant settlement case and export merchant-specific files by date range.")}
                </div>
              </Card>

              <Card className="space-y-5">
                <div>
                  <p className="subtle-label">{tx(locale, "صاحب الحساب", "Account owner")}</p>
                  <h2 className="mt-2 text-2xl font-black">{merchant.owner.name}</h2>
                </div>
                <div className="grid gap-3 text-sm text-text-secondary">
                  <div className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-primary-300" />{merchant.owner.phone || tx(locale, "مفيش رقم مسجل", "No phone recorded")}</div>
                  <div className="break-all">{merchant.owner.email}</div>
                </div>
              </Card>

              <Card className="space-y-5">
                <div>
                  <p className="subtle-label">{tx(locale, "تنبيهات تشغيلية", "Operational alerts")}</p>
                  <h2 className="mt-2 text-2xl font-black">{tx(locale, "الحاجات اللي محتاجة متابعة", "Items that need follow-up")}</h2>
                </div>
                {merchant.alerts?.length ? (
                  <div className="space-y-3">
                    {merchant.alerts.map((alert) => (
                      <div key={alert.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-text-primary">{localizeAlertTitle(alert, locale)}</div>
                            <div className="mt-1 text-sm text-text-secondary">{localizeAlertMessage(alert, locale)}</div>
                          </div>
                          <div className="text-xs text-text-tertiary">{formatDate(alert.createdAt, locale)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-text-secondary">
                    {tx(locale, "مفيش تنبيهات مفتوحة حالياً.", "No open alerts right now.")}
                  </div>
                )}
              </Card>

              <Card className="space-y-5">
                <div>
                  <p className="subtle-label">{tx(locale, "سجل التعديلات", "Audit trail")}</p>
                  <h2 className="mt-2 text-2xl font-black">{tx(locale, "آخر التعديلات الإدارية", "Recent admin changes")}</h2>
                </div>
                {merchant.auditTrail?.length ? (
                  <div className="space-y-3">
                    {merchant.auditTrail.map((event) => (
                      <div key={event.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-text-primary">{localizeAuditAction(event.action, locale)}</div>
                            <div className="mt-1 text-sm text-text-secondary">{auditSummaryLine(event, locale)}</div>
                            <div className="mt-2 text-xs text-text-tertiary">{event.actorEmail || tx(locale, "تعديل إداري", "Admin action")}</div>
                          </div>
                          <div className="text-xs text-text-tertiary">{formatDate(event.createdAt, locale)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-text-secondary">
                    {tx(locale, "لسه مفيش سجل تعديلات ظاهر.", "No audit events yet.")}
                  </div>
                )}
              </Card>
            </div>
          </form>
        ) : null}
      </div>
    </PageShell>
  );
}
