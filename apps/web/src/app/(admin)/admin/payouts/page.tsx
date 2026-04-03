"use client";

import React from "react";
import { Card, PageHeader, PageShell, StatusPill, text, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDate } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type PayoutRow = {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  baseSalary: number;
  orderBonus: number;
  penalties: number;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  hero: { id: string; name: string; email: string };
};

const copy = {
  title: text("المدفوعات", "Payouts"),
  subtitle: text("طلبات صرف الطيارين.", "Hero payout requests."),
  queue: text("طابور المدفوعات", "Payout queue"),
  queueTitle: text("طلبات السحب الحالية", "Current payout requests"),
  queueBody: text("راجع الراتب والحوافز والخصومات وصافي المستحق.", "Review salary, bonus, penalties, and net payout."),
  salary: text("راتب", "Salary"),
  bonus: text("حوافز", "Bonus"),
  penalties: text("خصومات", "Penalties"),
};

export default function AdminPayoutsPage() {
  const { locale, t } = useLocale();
  const [payouts, setPayouts] = React.useState<PayoutRow[]>([]);

  React.useEffect(() => {
    apiFetch<PayoutRow[]>("/v1/admin/payouts", undefined, "ADMIN").then(setPayouts);
  }, []);

  return (
    <PageShell
      role="ADMIN"
      user={{ name: text("مدير النظام", "Platform admin"), email: "admin@tayyar.app" }}
      pageTitle={copy.title}
      pageSubtitle={copy.subtitle}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={copy.queue}
          title={copy.queueTitle}
          subtitle={copy.queueBody}
          breadcrumbs={[
            { label: text("الإدارة", "Admin"), href: "/admin" },
            { label: copy.title },
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          {payouts.map((payout) => (
            <Card key={payout.id} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-text-primary">{payout.hero.name}</div>
                  <div className="mt-1 text-sm text-text-secondary">{payout.hero.email}</div>
                </div>
                <StatusPill label={{ ar: payout.status, en: payout.status }} tone={payout.status === "PAID" ? "success" : payout.status === "APPROVED" ? "primary" : "gold"} />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-xs text-text-tertiary">{t(copy.salary)}</div>
                  <div className="mt-2 font-mono text-lg font-bold text-text-primary">{formatLocalizedCurrency(payout.baseSalary, locale, payout.currency)}</div>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-xs text-text-tertiary">{t(copy.bonus)}</div>
                  <div className="mt-2 font-mono text-lg font-bold text-emerald-300">{formatLocalizedCurrency(payout.orderBonus, locale, payout.currency)}</div>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-xs text-text-tertiary">{t(copy.penalties)}</div>
                  <div className="mt-2 font-mono text-lg font-bold text-amber-300">{formatLocalizedCurrency(payout.penalties, locale, payout.currency)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-4">
                <div className="text-sm text-text-secondary">
                  {formatLocalizedDate(payout.periodStart, locale)} - {formatLocalizedDate(payout.periodEnd, locale)}
                </div>
                <div className="font-mono text-xl font-bold text-accent-300">{formatLocalizedCurrency(payout.totalAmount, locale, payout.currency)}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
