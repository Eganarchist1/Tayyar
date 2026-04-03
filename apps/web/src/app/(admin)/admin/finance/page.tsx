"use client";

import Link from "next/link";
import React from "react";
import { CalendarRange, Download, Landmark, MinusCircle, PlusCircle, Receipt, Search, Wallet } from "lucide-react";
import { Button, Card, EmptyStateCard, Input, InputWithIcon, PageHeader, PageShell, StatCard, StatusPill, useLocale, Select } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDate, formatLocalizedDateTime } from "@tayyar/utils";
import { apiDownload, apiFetch } from "@/lib/api";

type MerchantFinanceSummary = {
  merchantId: string;
  merchantName: string;
  merchantNameAr?: string | null;
  walletBalance: number;
  financeCase: {
    id: string | null;
    type: "PER_ORDER" | "RETAINER_DAILY" | "RETAINER_WEEKLY" | "RETAINER_MONTHLY" | null;
    scenario: "PER_ORDER" | "RETAINER" | "REVENUE_SHARE" | "HYBRID" | null;
    settlementCycle: "WEEKLY" | "MONTHLY" | null;
    value: number | null;
    settlementRate: number | null;
    retainerAmount: number | null;
    perOrderFee: number | null;
    currency: string;
    validFrom: string | null;
    validUntil: string | null;
    notes: string | null;
    isActive: boolean;
  };
  period: { from: string | null; to: string | null };
  totals: {
    orderCount: number;
    deliveredOrders: number;
    revenue: number;
    invoicesAmount: number;
    topups: number;
    adjustments: number;
    payouts: number;
  };
};

type MerchantFinanceDetail = MerchantFinanceSummary & {
  branches: Array<{ id: string; name: string; nameAr?: string | null; isActive: boolean }>;
  transactions: Array<{
    id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    description?: string | null;
    reference?: string | null;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    totalAmount: number;
    currency: string;
    status: string;
    dueDate: string;
    periodStart: string;
    periodEnd: string;
  }>;
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

function legacyContractTypeForCase(
  scenario: "PER_ORDER" | "RETAINER" | "REVENUE_SHARE" | "HYBRID",
  settlementCycle: "WEEKLY" | "MONTHLY",
) {
  if (scenario === "RETAINER") {
    return settlementCycle === "MONTHLY" ? "RETAINER_MONTHLY" : "RETAINER_WEEKLY";
  }

  return "PER_ORDER";
}

export default function AdminFinancePage() {
  const { locale } = useLocale();
  const [merchantSummaries, setMerchantSummaries] = React.useState<MerchantFinanceSummary[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = React.useState<string>("");
  const [detail, setDetail] = React.useState<MerchantFinanceDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [from, setFrom] = React.useState(daysAgoString(30));
  const [to, setTo] = React.useState(todayString());
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "gold"; message: string } | null>(null);
  const [savingCase, setSavingCase] = React.useState(false);
  const [savingAdjustment, setSavingAdjustment] = React.useState(false);
  const [downloadingKey, setDownloadingKey] = React.useState<string | null>(null);
  const [caseForm, setCaseForm] = React.useState({
    scenario: "PER_ORDER" as "PER_ORDER" | "RETAINER" | "REVENUE_SHARE" | "HYBRID",
    settlementCycle: "WEEKLY" as "WEEKLY" | "MONTHLY",
    settlementRate: "",
    retainerAmount: "",
    perOrderFee: "",
    validFrom: todayString(),
    validUntil: "",
    notes: "",
    isActive: true,
  });
  const [adjustmentForm, setAdjustmentForm] = React.useState({
    direction: "CREDIT",
    amount: "",
    reference: "",
    note: "",
  });

  const loadSummaries = React.useCallback(async () => {
    const payload = await apiFetch<{ merchants: MerchantFinanceSummary[] }>(
      `/v1/admin/finance/merchants${buildQuery({ from, to })}`,
      undefined,
      "ADMIN",
    );
    setMerchantSummaries(payload.merchants);

    setSelectedMerchantId((current) => {
      if (current && payload.merchants.some((item) => item.merchantId === current)) {
        return current;
      }
      return payload.merchants[0]?.merchantId || "";
    });
  }, [from, to]);

  const loadDetail = React.useCallback(async () => {
    if (!selectedMerchantId) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    try {
      const payload = await apiFetch<MerchantFinanceDetail>(
        `/v1/admin/finance/merchants/${selectedMerchantId}${buildQuery({ from, to })}`,
        undefined,
        "ADMIN",
      );
      setDetail(payload);
      setCaseForm({
        scenario: payload.financeCase.scenario || "PER_ORDER",
        settlementCycle: payload.financeCase.settlementCycle || "WEEKLY",
        settlementRate: payload.financeCase.settlementRate?.toString() || "",
        retainerAmount: payload.financeCase.retainerAmount?.toString() || "",
        perOrderFee: payload.financeCase.perOrderFee?.toString() || "",
        validFrom: payload.financeCase.validFrom ? payload.financeCase.validFrom.slice(0, 10) : todayString(),
        validUntil: payload.financeCase.validUntil ? payload.financeCase.validUntil.slice(0, 10) : "",
        notes: payload.financeCase.notes || "",
        isActive: payload.financeCase.isActive,
      });
    } finally {
      setDetailLoading(false);
    }
  }, [from, selectedMerchantId, to]);

  React.useEffect(() => {
    setLoading(true);
    setFeedback(null);
    loadSummaries()
      .catch((err) =>
        setFeedback({
          tone: "gold",
          message: err instanceof Error ? err.message : tx(locale, "تعذر تحميل ملخص المالية.", "Could not load finance summary."),
        }),
      )
      .finally(() => setLoading(false));
  }, [loadSummaries, locale]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const merchantId = params.get("merchantId");
    if (merchantId) {
      setSelectedMerchantId(merchantId);
    }
  }, []);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshing(true);
      Promise.all([loadSummaries(), loadDetail()]).finally(() => setRefreshing(false));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadDetail, loadSummaries]);

  const filteredMerchants = merchantSummaries.filter((item) =>
    `${item.merchantName} ${item.merchantNameAr || ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  async function handleCaseSave(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMerchantId) return;
    if (caseForm.scenario === "RETAINER" && !caseForm.retainerAmount) {
      setFeedback({
        tone: "gold",
        message: tx(locale, "حدد قيمة الريتينر قبل الحفظ.", "Enter a retainer amount before saving."),
      });
      return;
    }
    if (caseForm.scenario === "PER_ORDER" && !caseForm.perOrderFee) {
      setFeedback({
        tone: "gold",
        message: tx(locale, "حدد قيمة رسوم الطلب قبل الحفظ.", "Enter the per-order fee before saving."),
      });
      return;
    }
    setSavingCase(true);
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/finance/merchants/${selectedMerchantId}/case`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: legacyContractTypeForCase(caseForm.scenario, caseForm.settlementCycle),
            scenario: caseForm.scenario,
            settlementCycle: caseForm.settlementCycle,
            settlementRate: caseForm.settlementRate ? Number(caseForm.settlementRate) : null,
            retainerAmount: caseForm.retainerAmount ? Number(caseForm.retainerAmount) : null,
            perOrderFee: caseForm.perOrderFee ? Number(caseForm.perOrderFee) : null,
            validFrom: caseForm.validFrom,
            validUntil: caseForm.validUntil || null,
            notes: caseForm.notes || null,
            isActive: caseForm.isActive,
          }),
        },
        "ADMIN",
      );
      await Promise.all([loadSummaries(), loadDetail()]);
      setFeedback({ tone: "success", message: tx(locale, "تم حفظ الحالة المالية للتاجر.", "Merchant finance case saved.") });
    } catch (err) {
      setFeedback({ tone: "gold", message: err instanceof Error ? err.message : tx(locale, "تعذر حفظ الحالة المالية.", "Could not save finance case.") });
    } finally {
      setSavingCase(false);
    }
  }

  async function handleAdjustmentSave(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMerchantId) return;
    const amount = Number(adjustmentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback({
        tone: "gold",
        message: tx(locale, "اكتب مبلغًا صحيحًا أكبر من صفر.", "Enter a valid amount greater than zero."),
      });
      return;
    }
    setSavingAdjustment(true);
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/finance/merchants/${selectedMerchantId}/adjustments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(adjustmentForm.amount),
            direction: adjustmentForm.direction,
            reference: adjustmentForm.reference || undefined,
            note: adjustmentForm.note || undefined,
          }),
        },
        "ADMIN",
      );
      setAdjustmentForm({ direction: "CREDIT", amount: "", reference: "", note: "" });
      await Promise.all([loadSummaries(), loadDetail()]);
      setFeedback({ tone: "success", message: tx(locale, "تم تسجيل الحركة المالية.", "Finance adjustment recorded.") });
    } catch (err) {
      setFeedback({ tone: "gold", message: err instanceof Error ? err.message : tx(locale, "تعذر تسجيل الحركة المالية.", "Could not record adjustment.") });
    } finally {
      setSavingAdjustment(false);
    }
  }

  async function handleDownload(key: "orders" | "invoices" | "finance" | "summary") {
    if (!selectedMerchantId) return;
    setDownloadingKey(key);
    try {
      const file = await apiDownload(
        `/v1/admin/reports/export-file/${key}${buildQuery({ merchantId: selectedMerchantId, from, to, format: key === "summary" ? "json" : "csv" })}`,
        undefined,
        "ADMIN",
      );
      downloadBlob(file.filename, file.blob);
    } finally {
      setDownloadingKey(null);
    }
  }

  const totals = React.useMemo(
    () => ({
      merchants: merchantSummaries.length,
      revenue: merchantSummaries.reduce((sum, item) => sum + item.totals.revenue, 0),
      invoices: merchantSummaries.reduce((sum, item) => sum + item.totals.invoicesAmount, 0),
      balance: merchantSummaries.reduce((sum, item) => sum + item.walletBalance, 0),
    }),
    [merchantSummaries],
  );

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "المالية", en: "Finance" }}
      pageSubtitle={{ ar: "تسويات كل تاجر، العقود، والحركات المالية القابلة للتصدير.", en: "Merchant settlements, contracts, and exportable finance movement." }}
      showLive
      topbarActions={
        <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => void handleDownload("summary")} loading={downloadingKey === "summary"}>
          {tx(locale, "تصدير الملخص", "Export summary")}
        </Button>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "التسويات", en: "Settlements" }}
          title={{ ar: "مالية التجار", en: "Merchant finance" }}
          subtitle={{ ar: "اختَر التاجر، عدّل عقده، وسجّل الإضافات أو الخصومات من نفس الشاشة.", en: "Pick a merchant, update the contract, and record credits or debits from one screen." }}
          breadcrumbs={[
            { label: { ar: "الإدارة", en: "Admin" }, href: "/admin" },
            { label: { ar: "المالية", en: "Finance" } },
          ]}
          chips={[
            { label: { ar: `${merchantSummaries.length} تاجر`, en: `${merchantSummaries.length} merchants` }, tone: "primary" },
            { label: { ar: `${from} → ${to}`, en: `${from} → ${to}` }, tone: "neutral" },
          ]}
        />

        {feedback ? (
          <Card className={feedback.tone === "success" ? "border border-[var(--success-500)] bg-[var(--success-50)] text-sm text-[var(--success-700)] dark:border-[var(--success-600)] dark:bg-[var(--success-900)] dark:text-[var(--success-100)]" : "border border-[var(--danger-500)] bg-[var(--danger-50)] text-sm text-[var(--danger-600)] dark:border-[var(--danger-600)] dark:bg-[var(--danger-900)] dark:text-[var(--danger-100)]"}>
            {feedback.message}
          </Card>
        ) : null}

        <Card className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="subtle-label">{tx(locale, "نطاق التقرير", "Reporting range")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "حدد الفترة والتاجر", "Choose period and merchant")}</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_auto] xl:w-[760px]">
              <InputWithIcon icon={<Search className="h-4 w-4" />} placeholder={tx(locale, "ابحث عن تاجر", "Search merchant")} value={query} onChange={(event) => setQuery(event.target.value)} />
              <label className="space-y-2">
                <span className="subtle-label">{tx(locale, "من", "From")}</span>
                <input type="date" className="h-[46px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="subtle-label">{tx(locale, "إلى", "To")}</span>
                <input type="date" className="h-[46px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
              <Button variant="secondary" className="h-[46px] self-end" onClick={() => {
                setRefreshing(true);
                Promise.all([loadSummaries(), loadDetail()]).finally(() => setRefreshing(false));
              }} loading={loading || detailLoading || refreshing} icon={<CalendarRange className="h-4 w-4" />}>
                {tx(locale, "تحديث", "Refresh")}
              </Button>
            </div>
          </div>
        </Card>

        <section className="panel-grid xl:grid-cols-4">
          <StatCard label={{ ar: "التجار في التقرير", en: "Merchants in range" }} value={totals.merchants} icon={<Landmark className="h-5 w-5" />} loading={loading} />
          <StatCard label={{ ar: "إيراد الشبكة", en: "Network revenue" }} value={totals.revenue} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Wallet className="h-5 w-5" />} accentColor="success" loading={loading} />
          <StatCard label={{ ar: "قيمة الفواتير", en: "Invoice value" }} value={totals.invoices} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Receipt className="h-5 w-5" />} accentColor="gold" loading={loading} />
          <StatCard label={{ ar: "إجمالي الأرصدة", en: "Wallet balances" }} value={totals.balance} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Wallet className="h-5 w-5" />} accentColor="primary" loading={loading} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.38fr_0.62fr]">
          <Card className="space-y-4">
            <div>
              <p className="subtle-label">{tx(locale, "التجار", "Merchants")}</p>
              <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "حالات التسوية", "Settlement cases")}</h2>
            </div>
            <div className="space-y-3">
              {filteredMerchants.map((item) => {
                const active = selectedMerchantId === item.merchantId;
                return (
                  <button
                    key={item.merchantId}
                    type="button"
                    onClick={() => setSelectedMerchantId(item.merchantId)}
                    className={active ? "w-full rounded-[22px] border border-[var(--primary-500)] bg-[var(--primary-600)] bg-opacity-10 p-4 text-start transition-colors" : "w-full rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)] p-4 text-start transition-colors"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">{locale === "ar" ? item.merchantNameAr || item.merchantName : item.merchantName || item.merchantNameAr}</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">{locale === "ar" ? item.merchantName || item.merchantNameAr || "--" : item.merchantNameAr || item.merchantName || "--"}</div>
                      </div>
                      <StatusPill label={item.financeCase.isActive ? tx(locale, "مفعل", "Active") : tx(locale, "موقوف", "Paused")} tone={item.financeCase.isActive ? "success" : "gold"} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-[var(--text-secondary)]">
                      <div>{tx(locale, "الرصيد", "Balance")}: {formatLocalizedCurrency(item.walletBalance, locale)}</div>
                      <div>{tx(locale, "الإيراد", "Revenue")}: {formatLocalizedCurrency(item.totals.revenue, locale)}</div>
                      <div>{tx(locale, "الطلبات", "Orders")}: {item.totals.orderCount}</div>
                      <div>{tx(locale, "الفواتير", "Invoices")}: {formatLocalizedCurrency(item.totals.invoicesAmount, locale)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!loading && !filteredMerchants.length ? (
              <EmptyStateCard
                title={{ ar: "لا توجد حالات مطابقة", en: "No matching finance cases" }}
                description={{ ar: "جرّب اسم تاجر آخر أو وسّع الفترة الزمنية.", en: "Try another merchant name or widen the date range." }}
              />
            ) : null}
          </Card>

          <div className="space-y-6">
            {detail ? (
              <>
                <section className="panel-grid xl:grid-cols-4">
                  <StatCard label={{ ar: "الرصيد الحالي", en: "Wallet balance" }} value={detail.walletBalance} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<Wallet className="h-5 w-5" />} accentColor="primary" loading={detailLoading} />
                  <StatCard label={{ ar: "طلبات الفترة", en: "Orders in range" }} value={detail.totals.orderCount} icon={<Receipt className="h-5 w-5" />} accentColor="gold" loading={detailLoading} />
                  <StatCard label={{ ar: "طلبات مكتملة", en: "Delivered orders" }} value={detail.totals.deliveredOrders} icon={<PlusCircle className="h-5 w-5" />} accentColor="success" loading={detailLoading} />
                  <StatCard label={{ ar: "إجمالي التعديلات", en: "Net adjustments" }} value={detail.totals.adjustments} suffix={locale === "ar" ? "ج.م" : "EGP"} icon={<MinusCircle className="h-5 w-5" />} accentColor="warning" loading={detailLoading} />
                </section>

                <Card className="space-y-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="subtle-label">{tx(locale, "ملفات قابلة للتصدير", "Exportable files")}</p>
                      <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{tx(locale, "ملفات هذا التاجر", "This merchant's files")}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ["orders", tx(locale, "الطلبات", "Orders")],
                        ["invoices", tx(locale, "الفواتير", "Invoices")],
                        ["finance", tx(locale, "المالية", "Finance")],
                        ["summary", tx(locale, "الملخص", "Summary")],
                      ] as const).map(([key, label]) => (
                        <Button key={key} variant="secondary" size="sm" loading={downloadingKey === key} onClick={() => void handleDownload(key)} icon={<Download className="h-4 w-4" />}>
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {detail.branches.map((branch) => (
                      <Link key={branch.id} href={`/admin/branches/${branch.id}`} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4 transition-colors hover:border-[var(--primary-300)]">
                        <div className="font-bold text-[var(--text-primary)]">{locale === "ar" ? branch.nameAr || branch.name : branch.name || branch.nameAr}</div>
                        <div className="mt-2 text-sm text-[var(--text-secondary)]">{branch.isActive ? tx(locale, "شغال", "Active") : tx(locale, "مؤرشف", "Archived")}</div>
                      </Link>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Card className="space-y-5">
                    <div>
                      <p className="subtle-label">{tx(locale, "العقد", "Contract")}</p>
                      <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "إدارة حالة التسوية", "Manage settlement case")}</h2>
                    </div>
                    <form className="space-y-4" onSubmit={handleCaseSave}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "سيناريو التسوية", "Settlement scenario")}</span>
                          <Select
                            options={[
                              { label: tx(locale, "لكل طلب", "Per order"), value: "PER_ORDER" },
                              { label: tx(locale, "احتفاظ", "Retainer"), value: "RETAINER" },
                              { label: tx(locale, "مشاركة إيراد", "Revenue share"), value: "REVENUE_SHARE" },
                              { label: tx(locale, "مختلط", "Hybrid"), value: "HYBRID" },
                            ]}
                            value={caseForm.scenario}
                            onChange={(event) =>
                              setCaseForm((current) => ({
                                ...current,
                                scenario: event.target.value as "PER_ORDER" | "RETAINER" | "REVENUE_SHARE" | "HYBRID",
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "دورة التسوية", "Settlement cycle")}</span>
                          <Select
                            options={[
                              { label: tx(locale, "أسبوعي", "Weekly"), value: "WEEKLY" },
                              { label: tx(locale, "شهري", "Monthly"), value: "MONTHLY" },
                            ]}
                            value={caseForm.settlementCycle}
                            onChange={(event) =>
                              setCaseForm((current) => ({
                                ...current,
                                settlementCycle: event.target.value as "WEEKLY" | "MONTHLY",
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "نسبة التسوية", "Settlement rate")}</span>
                          <Input value={caseForm.settlementRate} onChange={(event) => setCaseForm((current) => ({ ...current, settlementRate: event.target.value }))} placeholder="0.15" />
                        </label>
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "الراتب الثابت", "Retainer")}</span>
                          <Input value={caseForm.retainerAmount} onChange={(event) => setCaseForm((current) => ({ ...current, retainerAmount: event.target.value }))} placeholder="0" />
                        </label>
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "رسوم الطلب", "Per-order fee")}</span>
                          <Input value={caseForm.perOrderFee} onChange={(event) => setCaseForm((current) => ({ ...current, perOrderFee: event.target.value }))} placeholder="0" />
                        </label>
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "ساري من", "Valid from")}</span>
                          <input type="date" className="h-[46px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]" value={caseForm.validFrom} onChange={(event) => setCaseForm((current) => ({ ...current, validFrom: event.target.value }))} />
                        </label>
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "ساري إلى", "Valid until")}</span>
                          <input type="date" className="h-[46px] w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-primary)]" value={caseForm.validUntil} onChange={(event) => setCaseForm((current) => ({ ...current, validUntil: event.target.value }))} />
                        </label>
                      </div>
                      <Input value={caseForm.notes} onChange={(event) => setCaseForm((current) => ({ ...current, notes: event.target.value }))} placeholder={tx(locale, "ملاحظات العقد", "Contract notes")} />
                      <button type="button" onClick={() => setCaseForm((current) => ({ ...current, isActive: !current.isActive }))} className={`flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-sm font-bold transition-colors ${caseForm.isActive ? "border-[var(--success-500)] bg-[var(--success-50)] text-[var(--success-700)] dark:border-[var(--success-600)] dark:bg-[var(--success-900)] dark:text-[var(--success-100)]" : "border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)]"}`}>
                        <span>{tx(locale, "حالة العقد", "Contract state")}</span>
                        <span>{caseForm.isActive ? tx(locale, "مفعل", "Active") : tx(locale, "موقوف", "Paused")}</span>
                      </button>
                      <Button type="submit" variant="gold" fullWidth loading={savingCase}>{tx(locale, "حفظ الحالة المالية", "Save finance case")}</Button>
                    </form>
                  </Card>

                  <Card className="space-y-5">
                    <div>
                      <p className="subtle-label">{tx(locale, "حركة يدوية", "Manual adjustment")}</p>
                      <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "إضافة أو خصم", "Credit or debit")}</h2>
                    </div>
                    <form className="space-y-4" onSubmit={handleAdjustmentSave}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "الاتجاه", "Direction")}</span>
                          <Select
                            options={[
                              { label: tx(locale, "إضافة", "Credit"), value: 'CREDIT' },
                              { label: tx(locale, "خصم", "Debit"), value: 'DEBIT' }
                            ]}
                            value={adjustmentForm.direction}
                            onChange={(event) => setAdjustmentForm((current) => ({ ...current, direction: event.target.value }))}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="subtle-label">{tx(locale, "المبلغ", "Amount")}</span>
                          <Input value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" />
                        </label>
                      </div>
                      <Input value={adjustmentForm.reference} onChange={(event) => setAdjustmentForm((current) => ({ ...current, reference: event.target.value }))} placeholder={tx(locale, "مرجع الحركة", "Reference")} />
                      <Input value={adjustmentForm.note} onChange={(event) => setAdjustmentForm((current) => ({ ...current, note: event.target.value }))} placeholder={tx(locale, "سبب الإضافة أو الخصم", "Adjustment note")} />
                      <Button type="submit" variant="secondary" fullWidth loading={savingAdjustment}>{tx(locale, "تسجيل الحركة", "Record adjustment")}</Button>
                    </form>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.58fr_0.42fr]">
                  <Card className="space-y-5">
                    <div>
                      <p className="subtle-label">{tx(locale, "الحركات", "Transactions")}</p>
                      <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "السجل المالي", "Finance ledger")}</h2>
                    </div>
                    <div className="grid gap-3">
                      {detail.transactions.map((transaction) => (
                        <div key={transaction.id} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-[var(--text-primary)]">{transaction.type}</div>
                              <div className="mt-1 text-sm text-[var(--text-secondary)]">{transaction.description || transaction.reference || tx(locale, "بدون وصف", "No description")}</div>
                            </div>
                            <StatusPill label={transaction.status} tone={transaction.status === "SUCCESS" ? "success" : "gold"} />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-secondary)] border-t border-[var(--border-default)] pt-3">
                            <span className="font-mono text-[var(--text-primary)]">{formatLocalizedCurrency(transaction.amount, locale)}</span>
                            <span>{formatLocalizedDateTime(transaction.createdAt, locale)}</span>
                          </div>
                        </div>
                      ))}
                      {!detail.transactions.length ? <EmptyStateCard title={{ ar: "لا توجد حركات", en: "No transactions" }} description={{ ar: "لا توجد حركات مالية في هذه الفترة.", en: "There are no finance transactions in this range." }} /> : null}
                    </div>
                  </Card>

                  <Card className="space-y-5">
                    <div>
                      <p className="subtle-label">{tx(locale, "الفواتير", "Invoices")}</p>
                      <h2 className="mt-2 text-xl font-black text-[var(--text-primary)]">{tx(locale, "آخر فواتير التاجر", "Recent invoices")}</h2>
                    </div>
                    <div className="grid gap-3">
                      {detail.invoices.map((invoice) => (
                        <div key={invoice.id} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-bold text-[var(--text-primary)]">{formatLocalizedCurrency(invoice.totalAmount, locale)}</div>
                              <div className="mt-1 text-sm text-[var(--text-secondary)]">{formatLocalizedDate(invoice.periodStart, locale)} → {formatLocalizedDate(invoice.periodEnd, locale)}</div>
                            </div>
                            <StatusPill label={invoice.status} tone={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "gold" : "primary"} />
                          </div>
                          <div className="mt-3 text-xs text-[var(--text-tertiary)] border-t border-[var(--border-default)] pt-3">{tx(locale, "الاستحقاق", "Due")}: {formatLocalizedDate(invoice.dueDate, locale)}</div>
                        </div>
                      ))}
                      {!detail.invoices.length ? <EmptyStateCard title={{ ar: "لا توجد فواتير", en: "No invoices" }} description={{ ar: "لا توجد فواتير في هذه الفترة.", en: "There are no invoices in this range." }} /> : null}
                    </div>
                  </Card>
                </div>
              </>
            ) : (
              <EmptyStateCard title={{ ar: "لا يوجد تاجر محدد", en: "No merchant selected" }} description={{ ar: "اختر تاجرًا من القائمة لعرض حالته المالية وتعديلها.", en: "Choose a merchant from the list to review and update its finance case." }} />
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
