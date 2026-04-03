"use client";

import React from "react";
import { Card, DataTable, PageHeader, PageShell, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedDateTime } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";

type BranchOrdersPayload = {
  branch: {
    id: string;
    name: string;
    nameAr?: string | null;
    brandName: string;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    customerName?: string | null;
    customerPhone: string;
    deliveryAddress?: string | null;
    requestedAt: string;
    zone: { id: string; name: string; nameAr?: string | null };
    hero?: { id: string; user?: { name?: string } | null } | null;
  }>;
};

type OrderRow = BranchOrdersPayload["orders"][0];

function tone(status: string): "primary" | "gold" | "success" | "neutral" {
  if (status === "DELIVERED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "gold";
  if (["REQUESTED", "ASSIGNED", "HERO_ACCEPTED", "PICKED_UP", "ON_WAY", "ARRIVED"].includes(status)) {
    return "primary";
  }
  return "neutral";
}

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) =>
  locale === "ar" ? ar || en || "--" : en || ar || "--";

export default function BranchOrdersPage() {
  const { locale } = useLocale();
  const [payload, setPayload] = React.useState<BranchOrdersPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<BranchOrdersPayload>("/v1/merchants/branch/orders", undefined, "BRANCH_MANAGER")
      .then(setPayload)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const columns = React.useMemo(
    () => [
      {
        key: "orderNumber",
        header: { ar: "رقم الطلب", en: "Order" },
        cell: (order: OrderRow) => <div className="font-mono font-bold text-[var(--text-primary)]">{order.orderNumber}</div>,
      },
      {
        key: "customer",
        header: { ar: "العميل", en: "Customer" },
        cell: (order: OrderRow) => (
          <div>
            <div className="font-bold text-[var(--text-primary)]">{order.customerName || tx(locale, "عميل", "Customer")}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]" dir="ltr">
              {order.customerPhone}
            </div>
          </div>
        ),
      },
      {
        key: "zone",
        header: { ar: "المنطقة", en: "Zone" },
        cell: (order: OrderRow) => <div className="text-[var(--text-secondary)]">{pickLabel(locale, order.zone.nameAr, order.zone.name)}</div>,
        hiddenOnMobile: true,
      },
      {
        key: "hero",
        header: { ar: "الطيار", en: "Hero" },
        cell: (order: OrderRow) => (
          <div className="text-[var(--text-secondary)]">{order.hero?.user?.name || tx(locale, "قيد الإسناد", "Pending assignment")}</div>
        ),
        hiddenOnMobile: true,
      },
      {
        key: "status",
        header: { ar: "الحالة", en: "Status" },
        cell: (order: OrderRow) => <StatusPill label={{ ar: order.status, en: order.status }} tone={tone(order.status)} />,
      },
      {
        key: "time",
        header: { ar: "وقت الطلب", en: "Requested at" },
        cell: (order: OrderRow) => <div className="text-[var(--text-secondary)]">{formatLocalizedDateTime(order.requestedAt, locale)}</div>,
        hiddenOnMobile: true,
      },
    ],
    [locale],
  );

  return (
    <PageShell
      role="BRANCH_MANAGER"
      user={{ name: { ar: "مدير الفرع", en: "Branch manager" }, email: "branch.manager@tayyar.app" }}
      pageTitle={{ ar: "طلبات الفرع", en: "Branch orders" }}
      pageSubtitle={{ ar: "كل طلبات الفرع من شاشة واحدة.", en: "All branch orders from one screen." }}
      showLive
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "الفرع", en: "Branch" }}
          title={{
            ar: payload?.branch.nameAr || payload?.branch.name || "طلبات الفرع",
            en: payload?.branch.name || payload?.branch.nameAr || "Branch orders",
          }}
          subtitle={{
            ar: payload ? `علامة ${payload.branch.brandName}` : "متابعة يومية للطلبات والطيارين المرتبطين بالفرع.",
            en: payload ? `Brand ${payload.branch.brandName}` : "Daily branch order view.",
          }}
          breadcrumbs={[
            { label: { ar: "الفرع", en: "Branch" }, href: "/branch/orders" },
            { label: { ar: "الطلبات", en: "Orders" } },
          ]}
        />

        {error ? (
          <Card className="border-[var(--danger-200)] bg-[var(--danger-50)] text-[var(--danger-700)] dark:border-[var(--danger-600)] dark:bg-[var(--danger-900)] dark:text-[var(--danger-100)]">
            {error}
          </Card>
        ) : null}

        <Card className="overflow-hidden border-[var(--border-default)]">
          <DataTable
            data={payload?.orders || []}
            columns={columns}
            loading={loading}
            keyExtractor={(order) => order.id}
            emptyStateTitle={{ ar: "لا توجد طلبات للفرع", en: "No branch orders yet" }}
            emptyStateMessage={{
              ar: "ستظهر هنا كل الطلبات الجديدة الخاصة بهذا الفرع.",
              en: "New orders for this branch will appear here.",
            }}
          />
        </Card>
      </div>
    </PageShell>
  );
}
