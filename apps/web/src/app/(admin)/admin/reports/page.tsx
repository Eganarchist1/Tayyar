"use client";

import React from "react";
import Link from "next/link";
import { CalendarRange, Download, FileSpreadsheet, Landmark, Receipt, Rocket } from "lucide-react";
import { Button, Card, EmptyStateCard, PageHeader, PageShell, Select, StatCard, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDate, formatLocalizedDateTime, formatLocalizedNumber } from "@tayyar/utils";
import { apiDownload, apiFetch } from "@/lib/api";

type MerchantOption = { id: string; name: string; nameAr?: string | null };

type ReportsPayload = {
  generatedAt: string;
  filters: { merchantId?: string | null; from?: string | null; to?: string | null };
  kpis: {
    totalOrders: number;
    deliveredOrders: number;
    totalRevenue: number;
    pendingPayouts: number;
    overdueInvoices: number;
  };
  exports: Array<{ key: "orders" | "payouts" | "invoices" | "finance"; labelAr: string; count: number; fileHint: string }>;
  merchants: Array<{ id: string; name: string; orderCount: number; revenue: number; avgDeliveryMins: number }>;
  zones: Array<{ id: string; name: string; city: string; activeHeroes: number; orders: number; revenue: number }>;
  heroes: Array<{ id: string; name: string; status: string; deliveredOrders: number; earnings: number }>;
  finance: Array<{
    merchantId: string;
    merchantName: string;
    merchantNameAr?: string | null;
    walletBalance: number;
    totals: { revenue: number; invoicesAmount: number; topups: number; adjustments: number; payouts: number };
  }>;
  payoutQueue: Array<{ id: string; heroName: string; totalAmount: number; baseSalary: number; orderBonus: number; penalties: number; createdAt: string }>;
  invoices: Array<{ id: string; merchantName: string; totalAmount: number; status: string; dueDate: string }>;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoString(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const output = search.toString();
  return output ? `?${output}` : "";
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminReportsPage() {
  const { locale } = useLocale();
  const [report, setReport] = React.useState<ReportsPayload | null>(null);
  const [merchants, setMerchants] = React.useState<MerchantOption[]>([]);
  const [merchantId, setMerchantId] = React.useState("");
  const [from, setFrom] = React.useState(daysAgoString(30));
  const [to, setTo] = React.useState(todayString());
  const [loading, setLoading] = React.useState(true);
  const [downloadingKey, setDownloadingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    const [reportPayload, merchantPayload] = await Promise.all([
      apiFetch<ReportsPayload>(`/v1/admin/reports/insights${buildQuery({ merchantId: merchantId || undefined, from, to })}`, undefined, "ADMIN"),
      apiFetch<MerchantOption[]>("/v1/admin/merchants?status=ACTIVE", undefined, "ADMIN"),
    ]);
    setReport(reportPayload);
    setMerchants(merchantPayload);
  }, [from, merchantId, to]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    loadData()
      .catch((err) => setError(err instanceof Error ? err.message : tx(locale, "تعذر تحميل التقارير.", "Could not load reports.")))
      .finally(() => setLoading(false));
  }, [loadData, locale]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextMerchantId = params.get("merchantId") || "";
    if (nextMerchantId) {
      setMerchantId(nextMerchantId);
    }
  }, []);

  async function handleDownload(key: "orders" | "payouts" | "invoices" | "finance" | "summary") {
    setDownloadingKey(key);
    try {
      const file = await apiDownload(
        `/v1/admin/reports/export-file/${key}${buildQuery({ merchantId: merchantId || undefined, from, to, format: key === "summary" ? "json" : "csv" })}`,
        undefined,
        "ADMIN",
      );
      downloadBlob(file.filename, file.blob);
    } finally {
      setDownloadingKey(null);
    }
  }

  const merchantOptions = [
    { label: tx(locale, "كل التجار", "All merchants"), value: "" },
    ...merchants.map(m => ({
      label: locale === "ar" ? (m.nameAr || m.name) : (m.name || m.nameAr || m.name),
      value: m.id
    }))
  ];

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "التقارير", en: "Reports" }}
      pageSubtitle={{ ar: "تقارير التشغيل والمالية والتصدير حسب الفترة والتاجر.", en: "Operations, finance, and export reporting by range and merchant." }}
      topbarActions={
        <Button variant="gold" size="sm" loading={downloadingKey === "summary"} icon={<Download className="h-4 w-4" />} onClick={() => void handleDownload("summary")}>
          {tx(locale, "تصدير الملخص", "Export summary")}
        </Button>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "التقارير", en: "Reports" }}
          title={{ ar: "لوحة التصدير والتحليل", en: "Export and insights board" }}
          subtitle={{ ar: "اختَر التاجر وحدد الفترة الزمنية ثم نزّل الملفات الجاهزة أو راجع الأداء من نفس الصفحة.", en: "Choose the merchant, set the date range, then download the prepared files or review performance from the same page." }}
          breadcrumbs={[
            { label: { ar: "الإدارة", en: "Admin" }, href: "/admin" },
            { label: { ar: "التقارير", en: "Reports" } },
          ]}
          chips={[
            { label: { ar: `${from} → ${to}`, en: `${from} → ${to}` }, tone: "neutral" },
            { label: { ar: merchantId ? "تقرير تاجر واحد" : "كل التجار", en: merchantId ? "Single merchant" : "All merchants" }, tone: merchantId ? "primary" : "success" },
          ]}
        />

        {error ? <Card className="border border-[var(--danger-500)] bg-[var(--danger-50)] text-sm text-[var(--danger-600)]">{error}</Card> : null}

        <Card className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="subtle-label">{tx(locale, "الفلترة", "Filters")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "الفترة والتاجر", "Date range and merchant")}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_auto] xl:w-[760px]">
              <label className="space-y-2">
                <span className="subtle-label">{tx(locale, "التاجر", "Merchant")}</span>
                <Select
                  options={merchantOptions}
                  value={merchantId}
                  onChange={(event) => setMerchantId(event.target.value)}
                />
              </label>
              <label className="space-y-2">
                <span className="subtle-label">{tx(locale, "من", "From")}</span>
                <input type="date" className="h-[46px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="subtle-label">{tx(locale, "إلى", "To")}</span>
                <input type="date" className="h-[46px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
              <Button variant="secondary" className="h-[46px] self-end" icon={<CalendarRange className="h-4 w-4" />} onClick={() => void loadData()} loading={loading}>
                {tx(locale, "تحديث", "Refresh")}
              </Button>
            </div>
          </div>
        </Card>

        <section className="panel-grid xl:grid-cols-4">
          <StatCard label={{ ar: "إجمالي الطلبات", en: "Total orders" }} value={report?.kpis.totalOrders ?? 0} icon={<FileSpreadsheet className="h-5 w-5" />} loading={loading} />
          <StatCard label={{ ar: "طلبات مكتملة", en: "Delivered orders" }} value={report?.kpis.deliveredOrders ?? 0} icon={<Rocket className="h-5 w-5" />} accentColor="success" loading={loading} />
          <StatCard label={{ ar: "إيرادات الشبكة", en: "Network revenue" }} value={report?.kpis.totalRevenue ?? 0} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Landmark className="h-5 w-5" />} accentColor="gold" loading={loading} />
          <StatCard label={{ ar: "فواتير متأخرة", en: "Overdue invoices" }} value={report?.kpis.overdueInvoices ?? 0} icon={<Receipt className="h-5 w-5" />} accentColor="warning" loading={loading} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
          <Card className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="subtle-label">{tx(locale, "حزم التصدير", "Export packs")}</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{tx(locale, "ملفات جاهزة", "Ready files")}</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{tx(locale, "ملفات متوافقة مع Excel/CSV للتشغيل والمالية والتسويات.", "Excel/CSV-compatible files for operations, finance, and settlements.")}</p>
              </div>
              <div className="rounded-[22px] border border-[var(--primary-500)] bg-[var(--primary-600)] bg-opacity-10 px-4 py-2 text-xs font-bold text-[var(--primary-600)]">
                {report ? formatLocalizedDateTime(report.generatedAt, locale) : tx(locale, "جار التحميل", "Loading")}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {report?.exports.map((item) => (
                <Card key={item.key} padding="sm" className="bg-[var(--bg-surface-2)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3"><FileSpreadsheet className="h-5 w-5 text-[var(--primary-500)]" /></div>
                    <span className="font-mono text-sm text-[var(--text-tertiary)]">{formatLocalizedNumber(item.count, locale)}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-black text-[var(--text-primary)]">{locale === "ar" ? item.labelAr : item.key}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-2">{item.fileHint}</p>
                  <Button className="mt-4 w-full" variant="secondary" size="sm" loading={downloadingKey === item.key} onClick={() => void handleDownload(item.key)}>
                    {tx(locale, "تنزيل", "Download")}
                  </Button>
                </Card>
              ))}
              <Card padding="sm" className="bg-[var(--bg-surface-2)] border-dashed">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3"><Download className="h-5 w-5 text-[var(--primary-500)]" /></div>
                  <span className="font-mono text-[10px] text-[var(--text-tertiary)] uppercase">{tx(locale, "حزمة إضافية", "Pack")}</span>
                </div>
                <h3 className="mt-4 text-lg font-black text-[var(--text-primary)]">{tx(locale, "إجمالي الإدارة", "Admin JSON")}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-2">{tx(locale, "ملف ملخص كامل للفترة نفسها.", "Full summary file for the same range.")}</p>
                <Button className="mt-4 w-full" variant="secondary" size="sm" loading={downloadingKey === "summary"} onClick={() => void handleDownload("summary")}>
                  {tx(locale, "تنزيل", "Download")}
                </Button>
              </Card>
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "المالية حسب التاجر", "Merchant finance")}</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{tx(locale, "ملخصات التسوية", "Settlement summaries")}</h2>
            </div>
            <div className="grid gap-3">
              {report?.finance.map((item) => (
                <Link key={item.merchantId} href={`/admin/finance?merchantId=${item.merchantId}`} className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4 transition-colors hover:border-[var(--primary-300)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{locale === "ar" ? item.merchantNameAr || item.merchantName : item.merchantName || item.merchantNameAr}</div>
                      <div className="mt-1 flex gap-2 text-sm text-[var(--text-secondary)]"><span>{tx(locale, "الرصيد:", "Bal:")}</span> <span className="font-mono text-[var(--text-primary)] font-medium">{formatLocalizedCurrency(item.walletBalance, locale)}</span></div>
                    </div>
                    <div className="text-sm font-mono text-[var(--success-500)]">{formatLocalizedCurrency(item.totals.revenue, locale)}</div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-3 border-t border-[var(--border-default)] pt-3">
                    <div><span className="text-[var(--text-tertiary)] block mb-0.5">{tx(locale, "فواتير", "Invoices")}</span> <span className="font-mono">{formatLocalizedCurrency(item.totals.invoicesAmount, locale)}</span></div>
                    <div><span className="text-[var(--text-tertiary)] block mb-0.5">{tx(locale, "إضافات", "Topups")}</span> <span className="font-mono">{formatLocalizedCurrency(item.totals.topups, locale)}</span></div>
                    <div><span className="text-[var(--text-tertiary)] block mb-0.5">{tx(locale, "معدل الإضافي", "Adjustments")}</span> <span className="font-mono">{formatLocalizedCurrency(item.totals.adjustments + item.totals.payouts, locale)}</span></div>
                  </div>
                </Link>
              ))}
              {!loading && !report?.finance.length ? <EmptyStateCard title={{ ar: "لا توجد بيانات مالية", en: "No finance data" }} description={{ ar: "لا توجد ملخصات مالية ضمن هذا النطاق.", en: "There are no finance summaries in this range." }} /> : null}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="space-y-4">
            <div>
              <p className="subtle-label">{tx(locale, "أفضل التجار", "Top merchants")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "حسب الإيراد", "By revenue")}</h2>
            </div>
            {report?.merchants.map((merchant) => (
              <Link key={merchant.id} href={`/admin/merchants/${merchant.id}`} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4 transition-colors hover:border-[var(--primary-300)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-[var(--text-primary)] truncate max-w-[150px]">{merchant.name}</div>
                  <div className="font-mono text-[var(--success-500)] font-medium shrink-0">{formatLocalizedCurrency(merchant.revenue, locale)}</div>
                </div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">{tx(locale, `${formatLocalizedNumber(merchant.orderCount, locale)} طلب • متوسط ${formatLocalizedNumber(merchant.avgDeliveryMins, locale)} دقيقة`, `${formatLocalizedNumber(merchant.orderCount, locale)} orders • Avg ${formatLocalizedNumber(merchant.avgDeliveryMins, locale)} min`)}</div>
              </Link>
            ))}
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="subtle-label">{tx(locale, "المناطق", "Zones")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "توزيع النشاط", "Activity split")}</h2>
            </div>
            {report?.zones.map((zone) => (
              <div key={zone.id} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">{zone.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-tertiary)]">{zone.city}</div>
                  </div>
                  <div className="font-mono text-[var(--primary-500)] font-medium">{formatLocalizedCurrency(zone.revenue, locale)}</div>
                </div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">{tx(locale, `${formatLocalizedNumber(zone.orders, locale)} طلب • ${formatLocalizedNumber(zone.activeHeroes, locale)} طيار نشط`, `${formatLocalizedNumber(zone.orders, locale)} orders • ${formatLocalizedNumber(zone.activeHeroes, locale)} active heroes`)}</div>
              </div>
            ))}
          </Card>

          <Card className="space-y-4">
            <div>
              <p className="subtle-label">{tx(locale, "الطيارون", "Heroes")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "الأعلى إنجازًا", "Top performers")}</h2>
            </div>
            {report?.heroes.map((hero) => (
              <div key={hero.id} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-[var(--text-primary)]">{hero.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-tertiary)]">{hero.status}</div>
                  </div>
                  <div className="font-mono text-[var(--success-500)] font-medium">{formatLocalizedCurrency(hero.earnings, locale)}</div>
                </div>
                <div className="mt-2 text-sm text-[var(--text-secondary)]">{tx(locale, `${formatLocalizedNumber(hero.deliveredOrders, locale)} طلب مكتمل`, `${formatLocalizedNumber(hero.deliveredOrders, locale)} delivered orders`)}</div>
              </div>
            ))}
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.54fr_0.46fr]">
          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "طابور السحب", "Payout queue")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "طلبات السحب الحالية", "Current payout queue")}</h2>
            </div>
            <div className="grid gap-3">
              {report?.payoutQueue.map((payout) => (
                <div key={payout.id} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{payout.heroName}</div>
                      <div className="mt-1 text-xs text-[var(--text-tertiary)]">{formatLocalizedDateTime(payout.createdAt, locale)}</div>
                    </div>
                    <div className="font-mono text-[var(--primary-600)] font-medium">{formatLocalizedCurrency(payout.totalAmount, locale)}</div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] py-3 border-t border-[var(--border-default)] md:grid-cols-3">
                    <div><span className="block mb-0.5 text-[var(--text-tertiary)]">{tx(locale, "راتب", "Salary")}</span> <span className="font-mono">{formatLocalizedCurrency(payout.baseSalary, locale)}</span></div>
                    <div><span className="block mb-0.5 text-[var(--text-tertiary)]">{tx(locale, "حوافز", "Bonus")}</span> <span className="font-mono text-[var(--success-500)]">{formatLocalizedCurrency(payout.orderBonus, locale)}</span></div>
                    <div><span className="block mb-0.5 text-[var(--text-tertiary)]">{tx(locale, "خصومات", "Penalties")}</span> <span className="font-mono text-[var(--danger-500)]">{formatLocalizedCurrency(payout.penalties, locale)}</span></div>
                  </div>
                </div>
              ))}
              {!loading && !report?.payoutQueue.length ? <EmptyStateCard title={{ ar: "لا توجد طلبات سحب", en: "No payout requests" }} description={{ ar: "لا توجد طلبات سحب ضمن هذا النطاق.", en: "There are no payout requests in this range." }} /> : null}
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "الفواتير", "Invoices")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "آخر الفواتير", "Latest invoices")}</h2>
            </div>
            <div className="grid gap-3">
              {report?.invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{invoice.merchantName}</div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">{formatLocalizedDate(invoice.dueDate, locale)}</div>
                    </div>
                    <div className="font-mono font-medium text-[var(--text-primary)]">{formatLocalizedCurrency(invoice.totalAmount, locale)}</div>
                  </div>
                  <div className="mt-3 text-sm text-[var(--text-secondary)] border-t border-[var(--border-default)] pt-3 flex items-center justify-between">
                     <span className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-wide">{tx(locale, "الحالة", "Status")}</span>
                     <StatusPill label={invoice.status} tone={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "gold" : "primary"} />
                  </div>
                </div>
              ))}
              {!loading && !report?.invoices.length ? <EmptyStateCard title={{ ar: "لا توجد فواتير", en: "No invoices" }} description={{ ar: "لا توجد فواتير ضمن هذا النطاق.", en: "There are no invoices in this range." }} /> : null}
            </div>
          </Card>
        </section>
      </div>
    </PageShell>
  );
}
