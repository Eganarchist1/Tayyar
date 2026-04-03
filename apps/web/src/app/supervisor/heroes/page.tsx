"use client";

import React from "react";
import { Card, PageHeader, PageShell, StatusPill, text, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";

type SupervisorHeroRecord = {
  id: string;
  status: string;
  isVerified: boolean;
  verificationStatus: string;
  totalDeliveries: number;
  currentLat?: number | null;
  currentLng?: number | null;
  user: {
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  zone?: { id: string; name?: string | null; nameAr?: string | null } | null;
  assignments: Array<{
    id: string;
    model: string;
    branch: {
      id: string;
      name: string;
      nameAr?: string | null;
      merchantName: string;
      merchantNameAr?: string | null;
    };
  }>;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) =>
  locale === "ar" ? ar || en || "--" : en || ar || "--";

function heroStatusTone(status: string): "success" | "primary" | "gold" | "neutral" {
  if (status === "ONLINE") return "success";
  if (status === "ON_DELIVERY") return "primary";
  if (status === "ON_BREAK") return "gold";
  return "neutral";
}

function heroStatusLabel(locale: "ar" | "en", status: string) {
  if (status === "ONLINE") return tx(locale, "متصل", "Online");
  if (status === "ON_DELIVERY") return tx(locale, "في مهمة", "On delivery");
  if (status === "ON_BREAK") return tx(locale, "استراحة", "On break");
  return tx(locale, "غير متصل", "Offline");
}

export default function SupervisorHeroesPage() {
  const { locale } = useLocale();
  const [heroes, setHeroes] = React.useState<SupervisorHeroRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadHeroes = React.useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await apiFetch<SupervisorHeroRecord[]>("/v1/supervisors/heroes", undefined, "SUPERVISOR");
        setHeroes(next);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : tx(locale, "تعذر تحميل الطيارين.", "Could not load heroes."));
      } finally {
        if (showLoading) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [locale],
  );

  React.useEffect(() => {
    void loadHeroes(true);
  }, [loadHeroes]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadHeroes(false);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadHeroes]);

  return (
    <PageShell
      role="SUPERVISOR"
      user={{ name: text("مشرف المنطقة", "Zone supervisor"), email: "supervisor@tayyar.app" }}
      pageTitle={text("الطيارون", "Heroes")}
      pageSubtitle={text("الحالة الحالية والتكليفات داخل نطاقك.", "Current status and assignments in your scope.")}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={text("الطيارون", "Heroes")}
          title={text("فريق التوصيل", "Delivery crew")}
          subtitle={text("راجع الحالة والتوثيق والتكليفات من شاشة واحدة.", "Review status, verification, and assignments from one screen.")}
          breadcrumbs={[
            { label: text("الإشراف", "Supervisor"), href: "/supervisor/map" },
            { label: text("الطيارون", "Heroes") },
          ]}
          chips={[
            { label: { ar: `${heroes.length} طيار`, en: `${heroes.length} heroes` }, tone: "primary" },
            {
              label: {
                ar: `${heroes.filter((hero) => hero.status === "ONLINE").length} متاح`,
                en: `${heroes.filter((hero) => hero.status === "ONLINE").length} online`,
              },
              tone: "success",
            },
            ...(refreshing ? [{ label: { ar: "جار التحديث", en: "Refreshing" }, tone: "neutral" as const }] : []),
          ]}
        />

        {error ? (
          <div className="rounded-[24px] border border-[var(--danger-500)] bg-[var(--danger-50)] px-5 py-4 text-sm font-bold text-[var(--danger-700)] dark:border-[var(--danger-600)] dark:bg-[var(--danger-900)] dark:text-[var(--danger-100)]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {heroes.map((hero) => (
            <Card key={hero.id} className="space-y-5 border-[var(--border-default)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg font-black text-[var(--text-primary)]">{hero.user.name}</div>
                  <div className="mt-1 text-sm font-bold text-[var(--text-secondary)]">
                    {pickLabel(locale, hero.zone?.nameAr, hero.zone?.name)}
                  </div>
                  <div className="mt-1 font-mono text-xs text-[var(--text-tertiary)]" dir="ltr">
                    {hero.user.phone || hero.user.email || "--"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <StatusPill label={heroStatusLabel(locale, hero.status)} tone={heroStatusTone(hero.status)} />
                  <StatusPill
                    label={hero.verificationStatus === "APPROVED" ? tx(locale, "موثق", "Verified") : tx(locale, "قيد المراجعة", "Pending")}
                    tone={hero.verificationStatus === "APPROVED" ? "success" : "gold"}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                  <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الطلبات المكتملة", "Completed orders")}</div>
                  <div className="mt-2 font-mono text-xl font-black text-[var(--text-primary)]">{hero.totalDeliveries}</div>
                </div>
                <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4 sm:col-span-2">
                  <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الموقع الحالي", "Current location")}</div>
                  <div className="mt-2 font-mono text-sm tracking-wide text-[var(--text-secondary)]" dir="ltr">
                    {hero.currentLat?.toFixed(5) || "--"}, {hero.currentLng?.toFixed(5) || "--"}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wide">
                  {tx(locale, "التكليفات الحالية", "Active assignments")}
                </div>
                {hero.assignments.length ? (
                  hero.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-sm flex justify-between items-center gap-4"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">
                          {pickLabel(locale, assignment.branch.nameAr, assignment.branch.name)}
                        </div>
                        <div className="mt-1 font-medium text-[var(--text-secondary)]">
                          {pickLabel(locale, assignment.branch.merchantNameAr, assignment.branch.merchantName)}
                        </div>
                      </div>
                      <div className="text-xs font-bold bg-[var(--primary-600)] bg-opacity-10 text-[var(--primary-600)] dark:text-[var(--primary-300)] border border-[var(--primary-500)] border-opacity-30 rounded-full px-3 py-1">
                        {assignment.model}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] border border-dashed border-[var(--border-default)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
                    {tx(locale, "لا توجد تكليفات نشطة للطيار.", "No active assignments.")}
                  </div>
                )}
              </div>
            </Card>
          ))}

          {!loading && !heroes.length ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-default)] px-5 py-10 text-center text-sm text-[var(--text-secondary)] col-span-full">
              {tx(locale, "لا يوجد طيارون داخل نطاقك الآن.", "There are no heroes in your scope right now.")}
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
