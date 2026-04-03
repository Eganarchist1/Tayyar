"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Archive, Plus, RotateCcw, Search } from "lucide-react";
import { Button, Card, DataTable, InputWithIcon, PageShell, StatusPill, useLocale } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";

type MerchantRecord = {
  id: string;
  name: string;
  nameAr?: string | null;
  branchCount?: number;
  orderCount?: number;
  isActive?: boolean;
  owner?: { name?: string | null; email?: string | null; phone?: string | null } | null;
};

type MerchantStatusFilter = "ACTIVE" | "ARCHIVED" | "ALL";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

export default function AdminMerchantsPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const [merchants, setMerchants] = React.useState<MerchantRecord[]>([]);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<MerchantStatusFilter>("ACTIVE");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const loadMerchants = React.useCallback(async () => {
    const apiStatus = statusFilter === "ARCHIVED" ? "INACTIVE" : statusFilter;
    const data = await apiFetch<MerchantRecord[]>(`/v1/admin/merchants?status=${apiStatus}`, undefined, "ADMIN");
    setMerchants(data);
  }, [statusFilter]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    loadMerchants()
      .catch((err) => setError(err instanceof Error ? err.message : tx(locale, "تعذر تحميل التجار.", "Could not load merchants.")))
      .finally(() => setLoading(false));
  }, [loadMerchants, locale]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshing(true);
      loadMerchants().finally(() => setRefreshing(false));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadMerchants]);

  async function toggleMerchantArchive(merchant: MerchantRecord, archived: boolean) {
    setTogglingId(merchant.id);
    setError(null);
    setFeedback(null);

    try {
      await apiFetch(
        `/v1/admin/merchants/${merchant.id}/archive`,
        {
          method: "PATCH",
          body: JSON.stringify({ archived }),
        },
        "ADMIN",
      );
      await loadMerchants();
      setFeedback(
        archived
          ? tx(locale, "تمت أرشفة التاجر وإخفاؤه من التشغيل النشط.", "Merchant archived and removed from active operations.")
          : tx(locale, "تمت إعادة تفعيل التاجر.", "Merchant reactivated."),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : tx(locale, "تعذر تحديث حالة التاجر.", "Could not update merchant state."));
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = merchants.filter((merchant) =>
    `${merchant.name} ${merchant.nameAr || ""} ${merchant.owner?.name || ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "التجار", en: "Merchants" }}
      pageSubtitle={{ ar: "إدارة التجار وحالة الأرشفة وملفات الملكية.", en: "Manage merchants, archive state, and ownership records." }}
      showLive
      topbarActions={
        <Button variant="gold" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => router.push("/admin/merchants/new")}>
          {tx(locale, "إضافة تاجر", "Add merchant")}
        </Button>
      }
    >
      <div className="space-y-6 md:space-y-8">
        {feedback ? (
          <Card className="border border-[var(--success-500)] bg-[var(--success-50)] py-3 text-sm font-medium text-[var(--success-700)]">
            {feedback}
          </Card>
        ) : null}

        <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="app-font-heading text-xl text-[var(--text-primary)]">{tx(locale, "حسابات التجار", "Merchant accounts")}</h2>
            <p className="app-font-body text-sm text-[var(--text-secondary)]">
              {tx(locale, "بدّل بين التجار النشطين والمؤرشفين وادخل إلى الملف المالي أو التشغيلي بسرعة.", "Switch between active and archived merchants and jump into their finance or operations record quickly.")}
            </p>
          </div>

          <div className="flex w-full max-w-3xl flex-col gap-3 lg:flex-row">
            <InputWithIcon
              icon={<Search className="h-4 w-4" />}
              containerClassName="w-full"
              placeholder={tx(locale, "ابحث باسم التاجر أو صاحب الحساب", "Search by merchant or owner")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="grid grid-cols-3 gap-2 lg:w-[360px]">
              {(["ACTIVE", "ARCHIVED", "ALL"] as MerchantStatusFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatusFilter(item)}
                  className={
                    statusFilter === item
                      ? "rounded-[18px] border border-[var(--primary-500)] bg-[var(--primary-500)] bg-opacity-10 px-3 py-3 text-xs font-bold text-[var(--primary-700)] shadow-sm"
                      : "rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-2)]"
                  }
                >
                  {item === "ACTIVE"
                    ? tx(locale, "النشطة", "Active")
                    : item === "ARCHIVED"
                      ? tx(locale, "المؤرشفة", "Archived")
                      : tx(locale, "الكل", "All")}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={loading || refreshing}
              onClick={() => {
                setRefreshing(true);
                loadMerchants().finally(() => setRefreshing(false));
              }}
            >
              {tx(locale, "تحديث", "Refresh")}
            </Button>
          </div>
        </Card>

        {error ? (
          <Card className="border border-[var(--gold-400)] bg-[var(--gold-500)] bg-opacity-10 py-3 text-sm font-medium text-[var(--gold-700)]">
            {error}
          </Card>
        ) : null}

        <Card className="overflow-hidden border border-[var(--border-default)] p-0">
          <DataTable
            data={filtered}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => router.push(`/admin/merchants/${item.id}`)}
            emptyMessage={
              loading
                ? tx(locale, "جارٍ تحميل التجار...", "Loading merchants...")
                : tx(locale, "لا توجد حسابات مطابقة لهذا الفلتر الآن.", "There are no merchants matching this filter right now.")
            }
            columns={[
              {
                header: tx(locale, "التاجر", "Merchant"),
                cell: (item: MerchantRecord) => (
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--accent-500)] border-opacity-20 bg-[var(--accent-500)] bg-opacity-10 text-sm font-black text-[var(--accent-700)]">
                      {item.name.slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">{locale === "ar" ? item.nameAr || item.name : item.name || item.nameAr}</div>
                      <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{locale === "ar" ? item.name || item.nameAr || "--" : item.nameAr || item.name || "--"}</div>
                    </div>
                  </div>
                ),
              },
              {
                header: tx(locale, "المالك", "Owner"),
                cell: (item: MerchantRecord) => (
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{item.owner?.name || tx(locale, "غير محدد", "Unassigned")}</div>
                    <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{item.owner?.phone || "--"}</div>
                  </div>
                ),
              },
              {
                header: tx(locale, "الفروع", "Branches"),
                cell: (item: MerchantRecord) => <div className="font-mono font-medium text-[var(--text-primary)]">{item.branchCount ?? 0}</div>,
              },
              {
                header: tx(locale, "الطلبات", "Orders"),
                cell: (item: MerchantRecord) => <div className="font-mono font-medium text-[var(--text-primary)]">{item.orderCount ?? 0}</div>,
              },
              {
                header: tx(locale, "الحالة", "Status"),
                cell: (item: MerchantRecord) => (
                  <StatusPill
                    label={item.isActive === false ? tx(locale, "مؤرشف", "Archived") : tx(locale, "نشط", "Active")}
                    tone={item.isActive === false ? "gold" : "success"}
                  />
                ),
              },
              {
                header: tx(locale, "إجراء", "Action"),
                cell: (item: MerchantRecord) => (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleMerchantArchive(item, item.isActive !== false);
                    }}
                    disabled={togglingId === item.id}
                    className="inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-500)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {item.isActive === false ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    {item.isActive === false ? tx(locale, "إعادة التفعيل", "Restore") : tx(locale, "أرشفة", "Archive")}
                  </button>
                ),
              },
            ]}
            mobileCardContent={(item: MerchantRecord) => (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-[var(--accent-500)] border-opacity-20 bg-[var(--accent-500)] bg-opacity-10 text-lg font-black text-[var(--accent-700)]">
                    {item.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold text-[var(--text-primary)]">{locale === "ar" ? item.nameAr || item.name : item.name || item.nameAr}</div>
                    <div className="truncate text-sm text-[var(--text-secondary)]">{locale === "ar" ? item.name || item.nameAr || "--" : item.nameAr || item.name || "--"}</div>
                  </div>
                  <StatusPill
                    label={item.isActive === false ? tx(locale, "مؤرشف", "Archived") : tx(locale, "نشط", "Active")}
                    tone={item.isActive === false ? "gold" : "success"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-[var(--border-default)] pt-3">
                  <div>
                    <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الفروع", "Branches")}</div>
                    <div className="mt-1 font-mono font-medium text-[var(--text-primary)]">{item.branchCount ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الطلبات", "Orders")}</div>
                    <div className="mt-1 font-mono font-medium text-[var(--text-primary)]">{item.orderCount ?? 0}</div>
                  </div>
                </div>

                <div className="space-y-1 border-t border-[var(--border-default)] pt-3">
                  <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "تواصل المالك", "Owner contact")}</div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{item.owner?.name || tx(locale, "غير محدد", "Unassigned")}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{item.owner?.phone || "--"}</div>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleMerchantArchive(item, item.isActive !== false);
                  }}
                  disabled={togglingId === item.id}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] transition hover:border-[var(--primary-500)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.isActive === false ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  {item.isActive === false ? tx(locale, "إعادة تفعيل التاجر", "Restore merchant") : tx(locale, "أرشفة التاجر", "Archive merchant")}
                </button>
              </div>
            )}
          />
        </Card>
      </div>
    </PageShell>
  );
}
