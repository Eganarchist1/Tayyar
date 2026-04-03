"use client";

import React from "react";
import { BadgeDollarSign, Radar, Rocket, ShieldCheck } from "lucide-react";
import { Card, EmptyStateCard, PageHeader, PageShell, StatCard, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedNumber } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type AssignmentRow = {
  id: string;
  model: string;
  baseSalary?: number | null;
  bonusPerOrder?: number | null;
  branch: { id: string; name: string; nameAr?: string | null };
  hero: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    status: string;
    efficiencyScore: number;
    totalDeliveries: number;
    ordersToday: number;
    walletBalance: number;
    activeOrders: number;
    zone?: { id: string; name: string; nameAr?: string | null } | null;
  };
};

function toneByStatus(status: string): "primary" | "gold" | "success" | "neutral" {
  if (status === "ONLINE") return "success";
  if (status === "DELIVERING" || status === "BUSY" || status === "ON_DELIVERY") return "primary";
  if (status === "OFFLINE") return "neutral";
  return "gold";
}

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) =>
  locale === "ar" ? ar || en || "--" : en || ar || "--";

export default function MerchantHeroesPage() {
  const { locale } = useLocale();
  const [assignments, setAssignments] = React.useState<AssignmentRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch<AssignmentRow[]>("/v1/merchants/heroes")
      .then(setAssignments)
      .finally(() => setLoading(false));
  }, []);

  const online = assignments.filter((item) => item.hero.status === "ONLINE").length;
  const activeOrders = assignments.reduce((sum, item) => sum + item.hero.activeOrders, 0);
  const averageEfficiency = assignments.length
    ? Math.round(assignments.reduce((sum, item) => sum + item.hero.efficiencyScore, 0) / assignments.length)
    : 0;

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "الطيارون", en: "Heroes" }}
      pageSubtitle={{ ar: "فريق التوصيل المخصص لفروعك.", en: "Delivery team assigned to your branches." }}
      showLive
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "فريق التوصيل", en: "Delivery team" }}
          title={{ ar: "الإسنادات الحالية", en: "Current assignments" }}
          subtitle={{ ar: "راجع الحالة والفرع والأداء من شاشة واحدة.", en: "Review branch, status, and performance from one screen." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/dashboard" },
            { label: { ar: "الطيارون", en: "Heroes" } },
          ]}
          chips={[
            { label: { ar: `${assignments.length} إسناد`, en: `${assignments.length} assignments` }, tone: "primary" },
            { label: { ar: `${online} متصل`, en: `${online} online` }, tone: "success" },
            { label: { ar: `${activeOrders} طلب نشط`, en: `${activeOrders} active orders` }, tone: "gold" },
          ]}
        />

        <section className="panel-grid">
          <StatCard label={{ ar: "إجمالي الإسنادات", en: "Assignments" }} value={assignments.length} icon={<Rocket className="h-5 w-5" />} loading={loading} />
          <StatCard label={{ ar: "الطيارون المتصلون", en: "Online heroes" }} value={online} icon={<ShieldCheck className="h-5 w-5" />} accentColor="success" loading={loading} />
          <StatCard label={{ ar: "الطلبات النشطة", en: "Active orders" }} value={activeOrders} icon={<Radar className="h-5 w-5" />} accentColor="primary" loading={loading} />
          <StatCard label={{ ar: "متوسط الكفاءة", en: "Average efficiency" }} value={averageEfficiency} suffix="%" icon={<BadgeDollarSign className="h-5 w-5" />} accentColor="gold" loading={loading} />
        </section>

        <Card className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="subtle-label">{tx(locale, "الفريق الميداني", "Field team")}</p>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">{tx(locale, "كل الإسنادات الحالية", "All current assignments")}</h2>
          </div>

          {loading ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[24px] bg-[var(--bg-surface-2)]" />
              ))}
            </div>
          ) : assignments.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)] transition-colors p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-black text-[var(--text-primary)]">{assignment.hero.name}</div>
                      <div className="mt-1 text-sm font-bold text-[var(--text-secondary)]">{pickLabel(locale, assignment.branch.nameAr, assignment.branch.name)}</div>
                    </div>
                    <StatusPill label={{ ar: assignment.hero.status, en: assignment.hero.status }} tone={toneByStatus(assignment.hero.status)} />
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                      <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "النموذج", "Model")}</div>
                      <div className="mt-2 font-bold text-[var(--text-primary)]">{assignment.model}</div>
                      <div className="mt-2 text-sm text-[var(--text-secondary)]">
                        {assignment.baseSalary
                          ? tx(locale, `${formatLocalizedCurrency(assignment.baseSalary, locale)} راتب`, `${formatLocalizedCurrency(assignment.baseSalary, locale)} salary`)
                          : tx(locale, "بدون راتب ثابت", "No fixed salary")}
                        {assignment.bonusPerOrder
                          ? tx(locale, ` • ${formatLocalizedCurrency(assignment.bonusPerOrder, locale)} لكل طلب`, ` • ${formatLocalizedCurrency(assignment.bonusPerOrder, locale)} per order`)
                          : ""}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                      <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الأداء", "Performance")}</div>
                      <div className="mt-2 font-black font-mono text-lg text-[var(--success-600)] dark:text-[var(--success-400)]">
                        {tx(locale, `${formatLocalizedNumber(assignment.hero.efficiencyScore, locale)}%`, `${formatLocalizedNumber(assignment.hero.efficiencyScore, locale)}%`)}
                      </div>
                      <div className="mt-2 text-sm text-[var(--text-secondary)]">
                        {tx(locale, `${formatLocalizedNumber(assignment.hero.totalDeliveries, locale)} مكتمل • ${formatLocalizedNumber(assignment.hero.ordersToday, locale)} اليوم`, `${formatLocalizedNumber(assignment.hero.totalDeliveries, locale)} completed • ${formatLocalizedNumber(assignment.hero.ordersToday, locale)} today`)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <div className="rounded-full px-3 py-1 text-xs font-bold bg-[var(--bg-surface-2)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                       {tx(locale, "المنطقة:", "Zone:")} {pickLabel(locale, assignment.hero.zone?.nameAr, assignment.hero.zone?.name)}
                    </div>
                    <div className="rounded-full px-3 py-1 text-xs font-bold bg-[var(--primary-600)] bg-opacity-10 text-[var(--primary-600)] dark:text-[var(--primary-300)] border border-[var(--primary-500)] border-opacity-30">
                       {tx(locale, "طلبات نشطة:", "Active:")} {formatLocalizedNumber(assignment.hero.activeOrders, locale)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateCard
              title={{ ar: "لا توجد إسنادات حالية", en: "No active assignments" }}
              description={{ ar: "سيظهر هنا كل طيار مرتبط بفروعك مع حالته الحالية.", en: "Assigned heroes appear here with their current status." }}
            />
          )}
        </Card>
      </div>
    </PageShell>
  );
}
