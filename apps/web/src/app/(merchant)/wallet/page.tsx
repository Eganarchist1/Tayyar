"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpLeft, CreditCard, Receipt, RefreshCw, Wallet2 } from "lucide-react";
import { Button, Card, EmptyStateCard, PageHeader, PageShell, StatCard, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDateTime } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type WalletTransaction = {
  id: string;
  type: string;
  status: string;
  amount: number;
  description?: string | null;
  createdAt: string;
};

type WalletPayload = {
  balance: number;
  transactions: WalletTransaction[];
};

type MerchantBootstrap = {
  brand: { id: string; name: string; nameAr?: string | null };
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

export default function MerchantWalletPage() {
  const { locale } = useLocale();
  const [wallet, setWallet] = React.useState<WalletPayload>({ balance: 0, transactions: [] });
  const [bootstrap, setBootstrap] = React.useState<MerchantBootstrap | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [topupLoading, setTopupLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    const [walletData, bootData] = await Promise.all([
      apiFetch<WalletPayload>("/v1/billing/wallet"),
      apiFetch<MerchantBootstrap>("/v1/merchants/bootstrap"),
    ]);
    setWallet(walletData);
    setBootstrap(bootData);
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

  const totalDeductions = wallet.transactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const totalTopups = wallet.transactions
    .filter((transaction) => transaction.type === "TOPUP")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  async function handleTopup() {
    if (!bootstrap?.brand.id) return;
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

  async function handleRefresh() {
    setRefreshing(true);
    setMessage(null);
    setError(null);
    try {
      await loadData();
      setMessage(tx(locale, "تم تحديث الرصيد والحركات.", "Balance and transactions updated."));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : tx(locale, "تعذر تحديث البيانات.", "Could not refresh billing data."));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "الفواتير والرصيد", en: "Billing" }}
      pageSubtitle={{ ar: "الرصيد والحركات والربط مع الفواتير.", en: "Balance, ledger, and invoice access." }}
      topbarActions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing} icon={<RefreshCw className="h-4 w-4" />}>
            {tx(locale, "تحديث", "Refresh")}
          </Button>
          <Link href="/merchant/invoices">
            <Button variant="secondary" size="sm" icon={<Receipt className="h-4 w-4" />}>
              {tx(locale, "الفواتير", "Invoices")}
            </Button>
          </Link>
          <Link href="/merchant/orders/new">
            <Button variant="secondary" size="sm">
              {tx(locale, "طلب جديد", "New order")}
            </Button>
          </Link>
          <Button variant="gold" size="sm" onClick={handleTopup} loading={topupLoading} icon={<CreditCard className="h-4 w-4" />}>
            {tx(locale, "شحن 1000 ج.م", "Top up EGP 1000")}
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "الرصيد", en: "Wallet" }}
          title={{ ar: "الحساب المالي", en: "Financial account" }}
          subtitle={{ ar: "راجع الرصيد والحركات ثم افتح الفواتير أو نفذ الشحن.", en: "Review balance and transactions, then open invoices or top up." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "الفواتير والرصيد", en: "Billing" } },
          ]}
          chips={[
            { label: { ar: `${wallet.transactions.length} حركة`, en: `${wallet.transactions.length} transactions` }, tone: "primary" },
            {
              label: {
                ar: bootstrap?.brand.nameAr || bootstrap?.brand.name || "المتجر",
                en: bootstrap?.brand.name || bootstrap?.brand.nameAr || "Store",
              },
              tone: "gold",
            },
          ]}
        />

        {message ? <Card className="border border-[var(--success-500)] bg-[var(--success-50)] text-[var(--success-700)] dark:border-[var(--success-600)] dark:bg-[var(--success-900)] dark:text-[var(--success-100)]">{message}</Card> : null}
        {error ? <Card className="border border-[var(--danger-500)] bg-[var(--danger-50)] text-[var(--danger-700)] dark:border-[var(--danger-600)] dark:bg-[var(--danger-900)] dark:text-[var(--danger-100)]">{error}</Card> : null}

        <section className="panel-grid">
          <StatCard label={{ ar: "الرصيد الحالي", en: "Current balance" }} value={wallet.balance} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Wallet2 className="h-5 w-5" />} loading={loading} />
          <StatCard label={{ ar: "إجمالي الشحن", en: "Total top-ups" }} value={totalTopups} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<CreditCard className="h-5 w-5" />} accentColor="gold" loading={loading} />
          <StatCard label={{ ar: "إجمالي الخصومات", en: "Total deductions" }} value={totalDeductions} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Receipt className="h-5 w-5" />} accentColor="warning" loading={loading} />
          <StatCard label={{ ar: "عدد الحركات", en: "Transactions" }} value={wallet.transactions.length} icon={<RefreshCw className="h-5 w-5" />} accentColor="success" loading={loading} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card variant="gold-accent" className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="subtle-label text-[var(--primary-700)] dark:text-[var(--primary-300)]">{tx(locale, "الرصيد المتاح", "Available balance")}</p>
                <h2 className="mt-2 font-mono text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                  {formatLocalizedCurrency(wallet.balance, locale)}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                  {tx(locale, "الشحن ينعكس فورا على الرصيد ويظهر في سجل الحركات.", "Top-ups update the wallet immediately and appear in the ledger.")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card padding="sm" className="bg-[var(--bg-surface)] dark:bg-[var(--bg-surface-2)] border-[var(--border-default)]">
                <p className="subtle-label">{tx(locale, "إجراء سريع", "Quick action")}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">{tx(locale, "شحن الرصيد", "Top up balance")}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{tx(locale, "أضف شحنا بقيمة 1000 ج.م.", "Add an instant EGP 1000 top-up.")}</p>
                <div className="mt-4">
                  <Button variant="gold" size="sm" onClick={handleTopup} loading={topupLoading}>
                    {tx(locale, "تنفيذ الشحن", "Run top-up")}
                  </Button>
                </div>
              </Card>

              <Card padding="sm" className="bg-[var(--bg-surface)] dark:bg-[var(--bg-surface-2)] border-[var(--border-default)]">
                <p className="subtle-label">{tx(locale, "إجراء سريع", "Quick action")}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--text-primary)]">{tx(locale, "فتح الفواتير", "Open invoices")}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{tx(locale, "راجع الفواتير والعقود من الشاشة المخصصة.", "Review invoices and contracts from the dedicated screen.")}</p>
                <Link href="/merchant/invoices" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--primary-600)] dark:text-[var(--primary-400)] hover:underline">
                  {tx(locale, "فتح شاشة الفواتير", "Open invoices")}
                  <ArrowUpLeft className="h-4 w-4" />
                </Link>
              </Card>
            </div>
          </Card>

          <Card className="space-y-5">
            <div>
              <p className="subtle-label">{tx(locale, "ملخص الحساب", "Account summary")}</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{tx(locale, "ملخص سريع", "Quick summary")}</h2>
            </div>
            <div className="space-y-4">
              {[
                {
                  label: tx(locale, "آخر شحن", "Latest top-up"),
                  value: wallet.transactions.find((transaction) => transaction.type === "TOPUP")?.amount
                    ? formatLocalizedCurrency(wallet.transactions.find((transaction) => transaction.type === "TOPUP")?.amount || 0, locale)
                    : tx(locale, "لا يوجد", "None"),
                },
                {
                  label: tx(locale, "آخر حركة", "Latest transaction"),
                  value: wallet.transactions[0] ? formatLocalizedDateTime(wallet.transactions[0].createdAt, locale) : tx(locale, "لا يوجد", "None"),
                },
                {
                  label: tx(locale, "حالة الحساب", "Account status"),
                  value: wallet.balance > 0 ? tx(locale, "جاهز", "Ready") : tx(locale, "يحتاج شحن", "Needs top-up"),
                },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-4">
                  <div className="font-bold text-[var(--text-primary)]">{item.label}</div>
                  <div className="text-sm font-medium text-[var(--text-secondary)]">{item.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section>
          <Card className="overflow-hidden space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="subtle-label">{tx(locale, "السجل المالي", "Ledger")}</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{tx(locale, "كل الحركات", "All transactions")}</h2>
              </div>
              <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
                {tx(locale, "تحديث", "Refresh")}
              </Button>
            </div>

            {wallet.transactions.length ? (
              <>
                <div className="grid gap-3 lg:hidden">
                  {wallet.transactions.map((transaction) => (
                    <div key={transaction.id} className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--text-primary)]">{transaction.description || humanizeType(transaction.type)}</div>
                          <div className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">#{transaction.id.slice(0, 8)}</div>
                        </div>
                        <StatusPill label={transaction.status} tone={transaction.status === "SUCCESS" ? "success" : "neutral"} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 pt-3 border-t border-[var(--border-default)]">
                        <div>
                          <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "النوع", "Type")}</div>
                          <div className="mt-1 text-[var(--text-secondary)] text-sm font-bold uppercase">{humanizeType(transaction.type)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "التاريخ", "Date")}</div>
                          <div className="mt-1 text-[var(--text-secondary)] text-sm font-bold">{formatLocalizedDateTime(transaction.createdAt, locale)}</div>
                        </div>
                      </div>
                      <div className={`mt-4 pt-3 border-t border-[var(--border-default)] font-mono text-lg font-bold ${transaction.amount >= 0 ? "text-[var(--success-600)] dark:text-[var(--success-400)]" : "text-[var(--danger-500)]"}`}>
                        {transaction.amount >= 0 ? "+" : "-"}
                        {formatLocalizedCurrency(Math.abs(transaction.amount), locale)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-[var(--border-default)] text-[var(--text-tertiary)]">
                      <tr>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "الوصف", "Description")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "النوع", "Type")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "التاريخ", "Date")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "الحالة", "Status")}</th>
                        <th className="px-4 py-3 text-start font-bold">{tx(locale, "القيمة", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)]">
                      {wallet.transactions.map((transaction) => (
                        <tr key={transaction.id} className="transition-colors hover:bg-[var(--bg-surface-2)]">
                          <td className="px-4 py-4">
                            <div className="font-bold text-[var(--text-primary)]">{transaction.description || humanizeType(transaction.type)}</div>
                            <div className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">#{transaction.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-4 py-4 font-bold uppercase text-[var(--text-secondary)]">{humanizeType(transaction.type)}</td>
                          <td className="px-4 py-4 font-bold text-[var(--text-secondary)]">{formatLocalizedDateTime(transaction.createdAt, locale)}</td>
                          <td className="px-4 py-4">
                            <StatusPill label={transaction.status} tone={transaction.status === "SUCCESS" ? "success" : "neutral"} />
                          </td>
                          <td className={`px-4 py-4 font-mono font-bold ${transaction.amount >= 0 ? "text-[var(--success-600)] dark:text-[var(--success-400)]" : "text-[var(--danger-500)]"}`}>
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
