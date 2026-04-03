"use client";

import React from "react";
import { Card, PageHeader, PageShell, StatusPill, text, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDate } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type InvoiceRow = {
  id: string;
  merchantName: string;
  totalAmount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  lineItemsCount: number;
  periodStart: string;
  periodEnd: string;
};

export default function AdminInvoicesPage() {
  const { locale, t } = useLocale();
  const [invoices, setInvoices] = React.useState<InvoiceRow[]>([]);

  React.useEffect(() => {
    apiFetch<InvoiceRow[]>("/v1/admin/invoices", undefined, "ADMIN").then(setInvoices);
  }, []);

  return (
    <PageShell
      role="ADMIN"
      user={{ name: text("مدير النظام", "Platform admin"), email: "admin@tayyar.app" }}
      pageTitle={text("الفواتير", "Invoices")}
      pageSubtitle={text("الفواتير التجارية وحالة السداد.", "Merchant invoices and payment status.")}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={text("الفواتير", "Invoices")}
          title={text("كل الفواتير", "All invoices")}
          subtitle={text("راجع الفترة والاستحقاق والحالة من جدول واحد.", "Review period, due date, and status from one table.")}
          breadcrumbs={[
            { label: text("الإدارة", "Admin"), href: "/admin" },
            { label: text("الفواتير", "Invoices") },
          ]}
        />

        <Card className="overflow-hidden">
          <div className="grid gap-3 lg:hidden">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="mobile-data-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-text-primary">{invoice.merchantName}</div>
                    <div className="mt-1 text-xs text-text-tertiary">
                      {formatLocalizedDate(invoice.periodStart, locale)} - {formatLocalizedDate(invoice.periodEnd, locale)}
                    </div>
                  </div>
                  <StatusPill label={{ ar: invoice.status, en: invoice.status }} tone={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "gold" : "primary"} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-text-tertiary">{t(text("عدد البنود", "Line items"))}</div>
                    <div className="mt-1 text-text-secondary">{invoice.lineItemsCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-tertiary">{t(text("الاستحقاق", "Due date"))}</div>
                    <div className="mt-1 text-text-secondary">{formatLocalizedDate(invoice.dueDate, locale)}</div>
                  </div>
                </div>
                <div className="mt-4 font-mono font-bold text-accent-300">{formatLocalizedCurrency(invoice.totalAmount, locale, invoice.currency)}</div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-white/8 text-text-tertiary">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t(text("التاجر", "Merchant"))}</th>
                  <th className="px-4 py-3 text-start font-bold">{t(text("الفترة", "Period"))}</th>
                  <th className="px-4 py-3 text-start font-bold">{t(text("عدد البنود", "Line items"))}</th>
                  <th className="px-4 py-3 text-start font-bold">{t(text("الاستحقاق", "Due date"))}</th>
                  <th className="px-4 py-3 text-start font-bold">{t(text("الحالة", "Status"))}</th>
                  <th className="px-4 py-3 text-start font-bold">{t(text("القيمة", "Amount"))}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-4 py-4 font-bold text-text-primary">{invoice.merchantName}</td>
                    <td className="px-4 py-4 text-text-secondary">
                      {formatLocalizedDate(invoice.periodStart, locale)} - {formatLocalizedDate(invoice.periodEnd, locale)}
                    </td>
                    <td className="px-4 py-4 text-text-secondary">{invoice.lineItemsCount}</td>
                    <td className="px-4 py-4 text-text-secondary">{formatLocalizedDate(invoice.dueDate, locale)}</td>
                    <td className="px-4 py-4">
                      <StatusPill label={{ ar: invoice.status, en: invoice.status }} tone={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "gold" : "primary"} />
                    </td>
                    <td className="px-4 py-4 font-mono text-accent-300">{formatLocalizedCurrency(invoice.totalAmount, locale, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
