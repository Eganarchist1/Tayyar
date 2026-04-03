"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpLeft, CalendarRange, CreditCard, Download, Map, Radar, Rocket, Store } from "lucide-react";
import { Button, Card, Input, PageHeader, PageShell, StatCard, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDateTime, formatLocalizedNumber } from "@tayyar/utils";
import type { OperationalAlertItem } from "@tayyar/types";
import { apiDownload, apiFetch } from "@/lib/api";
import { localizeAlertMessage, localizeAlertTitle } from "@/lib/ops";

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

type DashboardStats = { activeHeroes: number; totalOrders: number; totalRevenue: number; activeZones: number };
type ReportsOverview = {
  generatedAt: string;
  filters: { merchantId?: string | null; from?: string | null; to?: string | null };
  kpis: { deliveredOrders: number; pendingPayouts: number; overdueInvoices: number; totalOrders: number; totalRevenue: number };
  merchants: Array<{ id: string; name: string; revenue: number; orderCount: number }>;
  exports: Array<{ key: string; labelAr: string; count: number; fileHint: string }>;
};
type AlertRecord = OperationalAlertItem;

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const alertTone = (severity: string): "primary" | "gold" | "neutral" =>
  severity === "high" ? "primary" : severity === "medium" ? "gold" : "neutral";

export default function AdminLandingPage() {
  const { locale } = useLocale();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [reports, setReports] = React.useState<ReportsOverview | null>(null);
  const [alerts, setAlerts] = React.useState<AlertRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [from, setFrom] = React.useState(daysAgoString(30));
  const [to, setTo] = React.useState(todayString());
  const [downloadingKey, setDownloadingKey] = React.useState<string | null>(null);

  const loadDashboard = React.useCallback(async () => {
    const [statsData, reportsData, alertData] = await Promise.all([
      apiFetch<DashboardStats>("/v1/admin/dashboard/stats", undefined, "ADMIN"),
      apiFetch<ReportsOverview>(`/v1/admin/reports/insights${buildQuery({ from, to })}`, undefined, "ADMIN"),
      apiFetch<AlertRecord[]>("/v1/admin/alerts", undefined, "ADMIN"),
    ]);
    setStats(statsData);
    setReports(reportsData);
    setAlerts(alertData);
  }, [from, to]);

  React.useEffect(() => {
    setLoading(true);
    loadDashboard().finally(() => setLoading(false));
  }, [loadDashboard]);

  const shellNotifications = React.useMemo(
    () =>
      alerts.slice(0, 4).map((alert) => ({
        id: alert.id,
        title: localizeAlertTitle(alert, locale),
        description: localizeAlertMessage(alert, locale),
        href: alert.actionHref || "/admin",
        tone: alertTone(alert.severity),
        meta: formatLocalizedDateTime(alert.createdAt, locale),
      })),
    [alerts, locale],
  );

  async function handleDownload(key: string) {
    setDownloadingKey(key);
    try {
      const file = await apiDownload(`/v1/admin/reports/export-file/${key}${buildQuery({ from, to, format: key === "summary" ? "json" : "csv" })}`, undefined, "ADMIN");
      downloadBlob(file.filename, file.blob);
    } finally {
      setDownloadingKey(null);
    }
  }

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "لوحة التحكم", en: "Admin dashboard" }}
      pageSubtitle={{ ar: "حالة الشبكة والتنبيهات والتصدير للفترة المحددة.", en: "Network health, alerts, and exports for the selected period." }}
      showLive
      notifications={shellNotifications}
      notificationsLoading={loading}
      topbarActions={
        <>
          <Link href="/admin/reports">
            <Button variant="secondary" size="sm">{tx(locale, "التقارير", "Reports")}</Button>
          </Link>
          <Link href="/admin/map">
            <Button variant="gold" size="sm">{tx(locale, "افتح الخريطة", "Open map")}</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "نظرة سريعة", en: "Executive overview" }}
          title={{ ar: "لوحة الإدارة", en: "Admin overview" }}
          subtitle={{ ar: "راجع الطلبات والتنبيهات والإيراد من شاشة واحدة وحدد فترة العرض مباشرة.", en: "Review orders, alerts, and revenue from one screen and control the reporting range directly." }}
          breadcrumbs={[{ label: { ar: "الإدارة", en: "Admin" } }]}
          chips={[
            { label: { ar: `${stats?.activeHeroes ?? 0} طيار نشط`, en: `${stats?.activeHeroes ?? 0} active heroes` }, tone: "success" },
            { label: { ar: `${stats?.activeZones ?? 0} منطقة فعالة`, en: `${stats?.activeZones ?? 0} active zones` }, tone: "primary" },
            { label: { ar: `${from} → ${to}`, en: `${from} → ${to}` }, tone: "neutral" },
          ]}
        />

        <Card className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="subtle-label">{tx(locale, "الفترة الزمنية", "Date range")}</p>
              <h2 className="mt-2 text-xl font-black">{tx(locale, "التقارير الجاهزة لهذه الفترة", "Ready reports for this period")}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[160px_160px_auto] xl:w-[520px]">
              <label className="space-y-2">
                <span className="subtle-label">{tx(locale, "من", "From")}</span>
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="subtle-label">{tx(locale, "إلى", "To")}</span>
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
              <Button variant="secondary" className="h-12" icon={<CalendarRange className="h-4 w-4" />} onClick={() => void loadDashboard()} loading={loading}>
                {tx(locale, "تحديث", "Refresh")}
              </Button>
            </div>
          </div>
        </Card>

        <section className="panel-grid">
          <StatCard label={{ ar: "الطيارون النشطون", en: "Active heroes" }} value={stats?.activeHeroes ?? 0} icon={<Rocket className="h-5 w-5" />} loading={loading} />
          <StatCard label={{ ar: "كل الطلبات", en: "All orders" }} value={reports?.kpis.totalOrders ?? stats?.totalOrders ?? 0} icon={<Radar className="h-5 w-5" />} accentColor="primary" loading={loading} />
          <StatCard label={{ ar: "إيراد الشبكة", en: "Network revenue" }} value={reports?.kpis.totalRevenue ?? stats?.totalRevenue ?? 0} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<CreditCard className="h-5 w-5" />} accentColor="gold" loading={loading} />
          <StatCard label={{ ar: "المناطق الفعالة", en: "Active zones" }} value={stats?.activeZones ?? 0} icon={<Map className="h-5 w-5" />} accentColor="success" loading={loading} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card variant="elevated" className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="subtle-label">{tx(locale, "ملفات التصدير", "Export files")}</p>
                <h2 className="mt-2 text-2xl font-black">{tx(locale, "ملفات جاهزة", "Ready files")}</h2>
                <p className="mt-2 text-sm text-text-secondary">{tx(locale, "نزّل ملفات الطلبات والمدفوعات والفواتير مباشرة أو افتح التقارير للتفاصيل.", "Download orders, payouts, and invoices directly or open reports for full detail.")}</p>
              </div>
              <div className="rounded-[22px] border border-primary-500/20 bg-primary-500/10 px-4 py-2 text-xs font-bold text-primary-200">
                {reports ? formatLocalizedDateTime(reports.generatedAt, locale) : tx(locale, "جار التحديث", "Refreshing")}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {reports?.exports.map((item) => (
                <Card key={item.key} padding="sm" className="bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><Download className="h-5 w-5 text-primary-300" /></div>
                    <span className="font-mono text-sm text-accent-300">{formatLocalizedNumber(item.count, locale)}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-black">{locale === "ar" ? item.labelAr : item.key}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{item.fileHint}</p>
                  <Button className="mt-4 w-full" variant="secondary" size="sm" loading={downloadingKey === item.key} onClick={() => void handleDownload(item.key)}>
                    {tx(locale, "تنزيل", "Download")}
                  </Button>
                </Card>
              ))}
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "تنبيهات حالية", "Current alerts")}</p>
              <h2 className="mt-2 text-2xl font-black">{tx(locale, "أولوية المتابعة", "Items needing follow-up")}</h2>
            </div>
            <div className="space-y-4">
              {alerts.length
                ? alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                      <div className="font-bold text-text-primary">{localizeAlertTitle(alert, locale)}</div>
                      <div className="mt-2 text-sm text-text-secondary">{localizeAlertMessage(alert, locale)}</div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <StatusPill label={alert.severity === "high" ? { ar: "عاجل", en: "Urgent" } : { ar: "متابعة", en: "Follow-up" }} tone={alert.severity === "high" ? "primary" : "gold"} />
                        <span className="text-xs text-text-tertiary">{formatLocalizedDateTime(alert.createdAt, locale)}</span>
                      </div>
                    </div>
                  ))
                : [
                    { label: tx(locale, "مدفوعات بانتظار الاعتماد", "Payouts awaiting approval"), value: reports?.kpis.pendingPayouts ?? 0, tone: "gold" as const },
                    { label: tx(locale, "فواتير متأخرة", "Overdue invoices"), value: reports?.kpis.overdueInvoices ?? 0, tone: "primary" as const },
                    { label: tx(locale, "طلبات مكتملة", "Delivered orders"), value: reports?.kpis.deliveredOrders ?? 0, tone: "success" as const },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                      <div className="text-sm text-text-secondary">{item.label}</div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-3xl font-black text-text-primary">{formatLocalizedNumber(item.value, locale)}</div>
                        <StatusPill label={item.tone === "success" ? { ar: "مباشر", en: "Live" } : { ar: "مفتوح", en: "Open" }} tone={item.tone} />
                      </div>
                    </div>
                  ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="space-y-4">
            <div>
              <p className="subtle-label">{tx(locale, "أفضل التجار", "Top merchants")}</p>
              <h2 className="mt-2 text-xl font-black">{tx(locale, "حسب الإيراد", "By revenue")}</h2>
            </div>
            {reports?.merchants.map((merchant) => (
              <Link key={merchant.id} href={`/admin/merchants/${merchant.id}`} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-primary-500/20 hover:bg-primary-500/8">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-text-primary">{merchant.name}</div>
                  <div className="font-mono text-accent-300">{formatLocalizedCurrency(merchant.revenue, locale)}</div>
                </div>
                <div className="mt-2 text-sm text-text-secondary">
                  {tx(locale, `${formatLocalizedNumber(merchant.orderCount, locale)} طلب`, `${formatLocalizedNumber(merchant.orderCount, locale)} orders`)}
                </div>
              </Link>
            ))}
          </Card>

          <Link href="/admin/map">
            <Card className="h-full transition-transform duration-300 hover:-translate-y-1">
              <Map className="h-7 w-7 text-primary-300" />
              <h3 className="mt-5 text-xl font-black">{tx(locale, "الخريطة المباشرة", "Live map")}</h3>
              <p className="mt-3 text-sm text-text-secondary">{tx(locale, "راجع الطيارين والطلبات النشطة على الخريطة.", "See heroes and active orders on the map.")}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary-300">{tx(locale, "افتح الخريطة", "Open map")}<ArrowUpLeft className="h-4 w-4" /></div>
            </Card>
          </Link>
          <Link href="/admin/orders">
            <Card className="h-full transition-transform duration-300 hover:-translate-y-1">
              <Radar className="h-7 w-7 text-primary-300" />
              <h3 className="mt-5 text-xl font-black">{tx(locale, "غرفة الطلبات", "Orders room")}</h3>
              <p className="mt-3 text-sm text-text-secondary">{tx(locale, "راجع كل الطلبات حسب الحالة والمنطقة والطيار.", "Review all orders by status, zone, and hero.")}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary-300">{tx(locale, "افتح الطلبات", "Open orders")}<ArrowUpLeft className="h-4 w-4" /></div>
            </Card>
          </Link>
          <Link href="/admin/reports">
            <Card className="h-full transition-transform duration-300 hover:-translate-y-1">
              <Store className="h-7 w-7 text-accent-300" />
              <h3 className="mt-5 text-xl font-black">{tx(locale, "التقارير", "Reports")}</h3>
              <p className="mt-3 text-sm text-text-secondary">{tx(locale, "تقارير جاهزة للمالية والتشغيل مع فلترة زمنية.", "Prepared finance and operations reports with date filters.")}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary-300">{tx(locale, "افتح التقارير", "Open reports")}<ArrowUpLeft className="h-4 w-4" /></div>
            </Card>
          </Link>
        </section>
      </div>
    </PageShell>
  );
}
