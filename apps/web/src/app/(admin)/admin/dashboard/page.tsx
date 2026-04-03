"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpLeft, Building2, Map, Rocket, TrendingUp } from "lucide-react";
import { Button, Card, PageHeader, PageShell, StatCard, text, useLocale } from "@tayyar/ui";
import { formatLocalizedNumber } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type Stats = {
  activeHeroes: number;
  totalOrders: number;
  totalRevenue: number;
  activeZones: number;
};

const copy = {
  export: text("تصدير البيانات", "Export data"),
  addEntity: text("إضافة كيان", "Add entity"),
  pulse: text("نبض المنصة", "Platform pulse"),
  decisions: text("ملخص التشغيل", "Operations summary"),
  heroes: text("إدارة الطيارين", "Hero management"),
  heroesBody: text("الحالة والتوزيع وإضافة الحسابات.", "Status, assignment, and account setup."),
  merchants: text("التجار", "Merchants"),
  merchantsBody: text("العلامات والفروع ومالكو الحسابات.", "Brands, branches, and account owners."),
  zones: text("المناطق", "Zones"),
  zonesBody: text("حدود الخدمة والتغطية الحالية.", "Service boundaries and current coverage."),
  finance: text("المالية", "Finance"),
  financeBody: text("الحركة والرصيد والتقارير.", "Ledger, balances, and reports."),
  health: text("سلامة الشبكة", "Network health"),
  healthTitle: text("مؤشرات مباشرة", "Live indicators"),
  orderService: text("خدمة الطلبات", "Order service"),
  stable: text("مستقرة", "Stable"),
  measuring: text("جار القياس", "Measuring"),
  coverage: text("تغطية المناطق", "Zone coverage"),
  fleet: text("جاهزية الأسطول", "Fleet readiness"),
  activeHeroes: text("الطيارون النشطون", "Active heroes"),
  totalOrders: text("إجمالي الطلبات", "Total orders"),
  deliveryRevenue: text("إيراد التوصيل", "Delivery revenue"),
  activeZones: text("المناطق المفعلة", "Active zones"),
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboardPage() {
  const { locale, t } = useLocale();
  const [stats, setStats] = React.useState<Stats>({ activeHeroes: 0, totalOrders: 0, totalRevenue: 0, activeZones: 0 });
  const [loading, setLoading] = React.useState(true);

  const loadStats = React.useCallback(async () => {
    const data = await apiFetch<Stats>("/v1/admin/dashboard/stats", undefined, "ADMIN");
    setStats(data);
  }, []);

  React.useEffect(() => {
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadStats();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadStats]);

  return (
    <PageShell
      role="ADMIN"
      user={{ name: text("مدير النظام", "Platform admin"), email: "admin@tayyar.app" }}
      pageTitle={text("لوحة الإدارة", "Admin dashboard")}
      pageSubtitle={text("حالة التشغيل والتغطية وحجم الشبكة.", "Operations, coverage, and network scale.")}
      showLive
      topbarActions={
        <>
          <Button variant="secondary" size="sm" onClick={() => downloadJson("tayyar-admin-stats.json", stats)}>
            {t(copy.export)}
          </Button>
          <Link href="/admin/merchants">
            <Button variant="gold" size="sm">{t(copy.addEntity)}</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={copy.pulse}
          title={copy.decisions}
          subtitle={text("راجع أهم مؤشرات التشغيل والانتقال السريع إلى أدوات الإدارة.", "Review key operating metrics and jump directly into admin tools.")}
          breadcrumbs={[{ label: text("الإدارة", "Admin") }]}
        />

        <section className="panel-grid">
          <StatCard label={copy.activeHeroes} value={stats.activeHeroes} icon={<Rocket className="h-5 w-5" />} loading={loading} />
          <StatCard label={copy.totalOrders} value={stats.totalOrders} icon={<TrendingUp className="h-5 w-5" />} accentColor="gold" loading={loading} />
          <StatCard label={copy.deliveryRevenue} value={stats.totalRevenue} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Building2 className="h-5 w-5" />} accentColor="success" loading={loading} />
          <StatCard label={copy.activeZones} value={stats.activeZones} icon={<Map className="h-5 w-5" />} accentColor="warning" loading={loading} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card variant="elevated" className="space-y-6">
            <div>
              <p className="subtle-label">{t(copy.pulse)}</p>
              <h2 className="mt-2 text-2xl font-black">{t(copy.decisions)}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { href: "/admin/heroes", title: copy.heroes, body: copy.heroesBody },
                { href: "/admin/merchants", title: copy.merchants, body: copy.merchantsBody },
                { href: "/admin/zones", title: copy.zones, body: copy.zonesBody },
                { href: "/admin/finance", title: copy.finance, body: copy.financeBody },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-primary-500/20 hover:bg-white/[0.05]">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-text-primary">{t(item.title)}</div>
                      <div className="mt-1 text-sm text-text-secondary">{t(item.body)}</div>
                    </div>
                    <ArrowUpLeft className="h-4 w-4 text-primary-300" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{t(copy.health)}</p>
              <h2 className="mt-2 text-2xl font-black">{t(copy.healthTitle)}</h2>
            </div>
            {[
              { label: copy.orderService, value: loading ? t(copy.measuring) : t(copy.stable), pct: 94 },
              { label: copy.coverage, value: `${formatLocalizedNumber(stats.activeZones, locale)} ${locale === "ar" ? "منطقة" : "zones"}`, pct: Math.min(100, Math.max(20, stats.activeZones * 25)) },
              { label: copy.fleet, value: `${formatLocalizedNumber(stats.activeHeroes, locale)} ${locale === "ar" ? "طيار" : "heroes"}`, pct: Math.min(100, Math.max(20, stats.activeHeroes * 30)) },
            ].map((item) => (
              <div key={t(item.label)} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-text-secondary">{t(item.label)}</span>
                  <span className="font-bold text-primary-200">{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9,#38bdf8)]" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </PageShell>
  );
}
