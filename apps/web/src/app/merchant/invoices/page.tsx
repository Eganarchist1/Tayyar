"use client";

import React from "react";
import Link from "next/link";
import { CreditCard, FileText, Receipt, RefreshCw, Wallet2 } from "lucide-react";
import { Button, Card, EmptyStateCard, PageHeader, PageShell, StatCard, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDate, formatLocalizedDateTime } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type MerchantBillingPayload = {
  brand: {
    id: string;
    name: string;
    nameAr?: string | null;
    walletBalance: number;
    isActive: boolean;
  };
  contract: {
    id: string;
    type: string;
    value: number;
    currency: string;
    validFrom: string;
    validUntil?: string | null;
    notes?: string | null;
  } | null;
  invoices: Array<{
    id: string;
    totalAmount: number;
    currency: string;
    status: string;
    dueDate: string;
    paidAt?: string | null;
    periodStart: string;
    periodEnd: string;
    lineItems: Array<{ id: string; title: string; quantity: number; unitPrice: number; totalPrice: number }>;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    description?: string | null;
    createdAt: string;
  }>;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

export default function MerchantInvoicesPage() {
  const { locale } = useLocale();
  const [payload, setPayload] = React.useState<MerchantBillingPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [topupLoading, setTopupLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    const data = await apiFetch<MerchantBillingPayload>("/v1/merchants/invoices");
    setPayload(data);
  }, []);

  React.useEffect(() => {
    loadData()
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));
  }, [loadData]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData().catch(() => undefined);
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      await loadData();
      setMessage(tx(locale, "تم تحديث الفواتير والرصيد.", "Billing data updated."));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : tx(locale, "تعذر تحديث البيانات.", "Could not refresh billing data."));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTopup() {
    if (!payload?.brand.id) return;
    setTopupLoading(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch("/v1/billing/merchant/topup", {
        method: "POST",
        body: JSON.stringify({
          amount: 1000,
          reference: `TOPUP-${Date.now()}`,
        }),
      });
      await loadData();
      setMessage(tx(locale, "تم شحن الرصيد بقيمة 1000 ج.م.", "Wallet topped up by EGP 1000."));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : tx(locale, "تعذر شحن الرصيد.", "Could not top up the wallet."));
    } finally {
      setTopupLoading(false);
    }
  }

  const transactions = payload?.transactions || [];
  const invoices = payload?.invoices || [];
  const totalInvoices = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const pendingInvoices = invoices.filter((invoice) => invoice.status !== "PAID").length;

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "الفواتير والرصيد", en: "Billing" }}
      pageSubtitle={{ ar: "راجع الرصيد والفواتير والحركات.", en: "Review balance, invoices, and transactions." }}
      topbarActions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" />} loading={refreshing} onClick={handleRefresh}>
            {tx(locale, "تحديث", "Refresh")}
          </Button>
          <Button variant="gold" size="sm" icon={<CreditCard className="h-4 w-4" />} loading={topupLoading} onClick={handleTopup}>
            {tx(locale, "شحن 1000 ج.م", "Top up EGP 1000")}
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "الفواتير والرصيد", en: "Billing" }}
          title={{ ar: "الحساب المالي", en: "Financial account" }}
          subtitle={{ ar: "كل ما يخص الرصيد والفواتير والحركات في مكان واحد.", en: "Balance, invoices, and ledger in one place." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "الفواتير والرصيد", en: "Billing" } },
          ]}
          chips={[
            { label: { ar: `${invoices.length} فاتورة`, en: `${invoices.length} invoices` }, tone: "primary" },
            { label: { ar: `${transactions.length} حركة`, en: `${transactions.length} transactions` }, tone: "gold" },
          ]}
        />

        {message ? <Card className="border-emerald-500/20 bg-emerald-500/10 text-emerald-100">{message}</Card> : null}
        {error ? <Card className="border-danger-500/20 bg-danger-500/10 text-red-100">{error}</Card> : null}

        <section className="panel-grid">
          <StatCard
            label={{ ar: "الرصيد الحالي", en: "Current balance" }}
            value={payload?.brand.walletBalance || 0}
            suffix={locale === "ar" ? "ج.م" : "EGP"}
            icon={<Wallet2 className="h-5 w-5" />}
            loading={loading}
          />
          <StatCard
            label={{ ar: "إجمالي الفواتير", en: "Invoice total" }}
            value={totalInvoices}
            suffix={locale === "ar" ? "ج.م" : "EGP"}
            icon={<Receipt className="h-5 w-5" />}
            accentColor="gold"
            loading={loading}
          />
          <StatCard
            label={{ ar: "فواتير مفتوحة", en: "Open invoices" }}
            value={pendingInvoices}
            icon={<FileText className="h-5 w-5" />}
            accentColor="warning"
            loading={loading}
          />
          <StatCard
            label={{ ar: "الحركات", en: "Transactions" }}
            value={transactions.length}
            icon={<RefreshCw className="h-5 w-5" />}
            accentColor="success"
            loading={loading}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="subtle-label">{tx(locale, "ملخص الحساب", "Account summary")}</p>
                <h2 className="mt-2 text-2xl font-black">{tx(locale, "الوضع الحالي", "Current status")}</h2>
              </div>
              <Link href="/merchant/orders/new">
                <Button variant="secondary" size="sm">
                  {tx(locale, "طلب جديد", "New order")}
                </Button>
              </Link>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-xs text-text-tertiary">{tx(locale, "اسم المتجر", "Store")}</div>
                <div className="mt-2 text-lg font-black text-text-primary">
                  {locale === "ar"
                    ? payload?.brand.nameAr || payload?.brand.name || "--"
                    : payload?.brand.name || payload?.brand.nameAr || "--"}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-xs text-text-tertiary">{tx(locale, "نوع التعاقد", "Contract")}</div>
                <div className="mt-2 text-lg font-black text-text-primary">
                  {payload?.contract?.type || tx(locale, "غير مسجل", "Not set")}
                </div>
                <div className="mt-2 text-sm text-text-secondary">
                  {payload?.contract
                    ? `${formatLocalizedCurrency(payload.contract.value, locale)} / ${payload.contract.currency}`
                    : tx(locale, "لا يوجد عقد نشط.", "No active contract.")}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                <div className="text-xs text-text-tertiary">{tx(locale, "آخر حركة", "Latest transaction")}</div>
                <div className="mt-2 text-lg font-black text-text-primary">
                  {transactions[0] ? humanizeType(transactions[0].type) : tx(locale, "لا يوجد", "None")}
                </div>
                <div className="mt-2 text-sm text-text-secondary">
                  {transactions[0] ? formatLocalizedDateTime(transactions[0].createdAt, locale) : tx(locale, "لا توجد حركات بعد.", "No transactions yet.")}
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "الفواتير", "Invoices")}</p>
              <h2 className="mt-2 text-2xl font-black">{tx(locale, "الفواتير الحالية", "Current invoices")}</h2>
            </div>

            {loading ? (
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-[24px] bg-white/[0.05]" />
                ))}
              </div>
            ) : invoices.length ? (
              <div className="grid gap-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5 transition-all duration-200 hover:border-primary-400/30 hover:bg-white/[0.05]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-black text-text-primary">#{invoice.id.slice(0, 8)}</div>
                        <div className="mt-1 text-sm text-text-secondary">
                          {formatLocalizedDate(invoice.periodStart, locale)} - {formatLocalizedDate(invoice.periodEnd, locale)}
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-text-secondary">
                        {invoice.status}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="text-sm text-text-secondary">{tx(locale, "تاريخ الاستحقاق", "Due date")}</div>
                      <div className="font-bold text-text-primary">{formatLocalizedDate(invoice.dueDate, locale)}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="text-sm text-text-secondary">{tx(locale, "القيمة", "Amount")}</div>
                      <div className="font-mono text-lg font-black text-accent-300">{formatLocalizedCurrency(invoice.totalAmount, locale)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStateCard
                title={{ ar: "لا توجد فواتير بعد", en: "No invoices yet" }}
                description={{ ar: "الحركات موجودة، والفواتير ستظهر هنا عند إصدارها.", en: "Transactions exist, and invoices will appear here once issued." }}
              />
            )}
          </Card>
        </section>

        <section>
          <Card className="overflow-hidden">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="subtle-label">{tx(locale, "سجل الحركات", "Transaction ledger")}</p>
                <h2 className="mt-2 text-2xl font-black">{tx(locale, "كل الحركات", "All transactions")}</h2>
              </div>
            </div>

            {transactions.length ? (
              <>
                <div className="grid gap-3 lg:hidden">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="mobile-data-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-text-primary">{transaction.description || humanizeType(transaction.type)}</div>
                          <div className="mt-1 text-xs text-text-tertiary">#{transaction.id.slice(0, 8)}</div>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-text-secondary">
                          {transaction.status}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-text-tertiary">{tx(locale, "النوع", "Type")}</div>
                          <div className="mt-1 text-text-secondary">{humanizeType(transaction.type)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-text-tertiary">{tx(locale, "التاريخ", "Date")}</div>
                          <div className="mt-1 text-text-secondary">{formatLocalizedDateTime(transaction.createdAt, locale)}</div>
                        </div>
                      </div>
                      <div className={`mt-4 font-mono text-base font-bold ${transaction.amount >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                        {transaction.amount >= 0 ? "+" : "-"}
                        {formatLocalizedCurrency(Math.abs(transaction.amount), locale)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-white/8 text-text-tertiary">
                      <tr>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "الوصف", "Description")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "النوع", "Type")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "التاريخ", "Date")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "الحالة", "Status")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "القيمة", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="px-4 py-4">
                            <div className="font-bold text-text-primary">{transaction.description || humanizeType(transaction.type)}</div>
                            <div className="mt-1 text-xs text-text-tertiary">#{transaction.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-4 py-4 text-text-secondary">{humanizeType(transaction.type)}</td>
                          <td className="px-4 py-4 text-text-secondary">{formatLocalizedDateTime(transaction.createdAt, locale)}</td>
                          <td className="px-4 py-4 text-text-secondary">{transaction.status}</td>
                          <td className={`px-4 py-4 font-mono font-bold ${transaction.amount >= 0 ? "text-emerald-300" : "text-amber-300"}`}>
                            {transaction.amount >= 0 ? "+" : "-"}
                            {formatLocalizedCurrency(Math.abs(transaction.amount), locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyStateCard
                title={{ ar: "لا توجد حركات مالية", en: "No transactions yet" }}
                description={{ ar: "ستظهر الحركات هنا بعد أول شحن أو تسوية.", en: "Transactions appear here after the first top-up or settlement." }}
              />
            )}
          </Card>
        </section>
      </div>
    </PageShell>
  );
}

function humanizeType(type: string) {
  return type.replace(/_/g, " ").toLowerCase();
}
