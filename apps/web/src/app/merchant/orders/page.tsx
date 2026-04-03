"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpLeft, Package, Radar, Rocket, ArrowRight } from "lucide-react";
import { Button, Card, PageHeader, PageShell, StatCard, StatusPill, useLocale, DataTable } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";
import { formatOrderTimestamp, orderStatusText, orderStatusTone } from "@/lib/order-status";
import { useSocket } from "@/hooks/useSocket";

type OrderRow = {
  id: string;
  trackingId: string;
  orderNumber: string;
  status: string;
  deliveryFee?: number | null;
  requestedAt: string;
  deliveryAddress?: string | null;
  customerName?: string | null;
  customerPhone: string;
  branch: { id: string; name: string; nameAr?: string | null };
  hero?: { id: string; user?: { name?: string } | null } | null;
  zone: { id: string; name: string; nameAr?: string | null };
};

const activeStatuses = new Set([
  "REQUESTED",
  "ASSIGNED",
  "HERO_ACCEPTED",
  "ARRIVED_PICKUP",
  "PICKED_UP",
  "ON_WAY",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
  "ARRIVED",
]);

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) =>
  locale === "ar" ? ar || en || "--" : en || ar || "--";

export default function MerchantOrdersPage() {
  const { locale } = useLocale();
  const [orders, setOrders] = React.useState<OrderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const { lastMessage } = useSocket(["orders"]);

  const loadOrders = React.useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const nextOrders = await apiFetch<OrderRow[]>("/v1/merchants/orders");
        setOrders(nextOrders);
      } finally {
        if (showLoading) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [],
  );

  React.useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  React.useEffect(() => {
    if (!lastMessage) {
      return;
    }

    if (lastMessage.type === "ORDER_STATUS_UPDATE" || lastMessage.type === "ORDER_CREATED") {
      void loadOrders(false);
    }
  }, [lastMessage, loadOrders]);

  const delivered = orders.filter((order) => order.status === "DELIVERED").length;
  const active = orders.filter((order) => activeStatuses.has(order.status)).length;
  const revenue = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);

  const columns = React.useMemo(() => [
    {
      key: "orderNumber",
      header: { ar: "رقم الطلب", en: "Order" },
      cell: (order: OrderRow) => (
        <div>
          <div className="font-mono text-sm font-bold text-[var(--text-primary)]">{order.orderNumber}</div>
          <div className="mt-1 text-xs text-[var(--text-tertiary)]" dir="ltr">{order.customerPhone}</div>
        </div>
      )
    },
    {
      key: "customer",
      header: { ar: "العميل", en: "Customer" },
      cell: (order: OrderRow) => (
        <div>
          <div className="font-bold text-[var(--text-primary)]">{order.customerName || tx(locale, "عميل جديد", "New customer")}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">{order.deliveryAddress || tx(locale, "مفيش عنوان مكتوب", "No text address")}</div>
        </div>
      )
    },
    {
      key: "branch",
      header: { ar: "الفرع", en: "Branch" },
      cell: (order: OrderRow) => <div className="text-[var(--text-secondary)]">{pickLabel(locale, order.branch.nameAr, order.branch.name)}</div>,
      hiddenOnMobile: true
    },
    {
      key: "zone",
      header: { ar: "المنطقة", en: "Zone" },
      cell: (order: OrderRow) => <div className="text-[var(--text-secondary)]">{pickLabel(locale, order.zone.nameAr, order.zone.name)}</div>,
      hiddenOnMobile: true
    },
    {
      key: "hero",
      header: { ar: "الطيار", en: "Hero" },
      cell: (order: OrderRow) => <div className="text-[var(--text-secondary)]">{order.hero?.user?.name || tx(locale, "لسه بيتوزع", "Pending assignment")}</div>,
      hiddenOnMobile: true
    },
    {
      key: "status",
      header: { ar: "الحالة", en: "Status" },
      cell: (order: OrderRow) => <StatusPill label={orderStatusText(order.status)} tone={orderStatusTone(order.status)} />
    },
    {
      key: "time",
      header: { ar: "الوقت", en: "Time" },
      cell: (order: OrderRow) => <div className="text-[var(--text-secondary)]">{formatOrderTimestamp(order.requestedAt, locale)}</div>,
      hiddenOnMobile: true
    },
    {
      key: "action",
      header: "",
      cell: (order: OrderRow) => (
        <Link href={`/merchant/orders/${order.id}`}>
          <Button variant="secondary" size="sm" icon={<ArrowRight className="h-4 w-4" />}>
            {tx(locale, "التفاصيل", "Details")}
          </Button>
        </Link>
      ),
      align: "right" as const
    }
  ], [locale]);

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "الطلبات", en: "Orders" }}
      pageSubtitle={{ ar: "كل الطلبات والتتبع.", en: "All orders and tracking." }}
      showLive
      topbarActions={
        <Link href="/merchant/orders/new">
          <Button variant="gold" size="sm" icon={<Rocket className="h-4 w-4" />}>
            {tx(locale, "طلب جديد", "New order")}
          </Button>
        </Link>
      }
    >
      <div className="space-y-6 md:space-y-8">
        <PageHeader
          eyebrow={{ ar: "الطلبات", en: "Orders" }}
          title={{ ar: "إدارة الطلبات", en: "Order operations" }}
          subtitle={{ ar: "تفاصيل الطلب والحالة والطيار.", en: "Order details, status, and assigned hero." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/dashboard" },
            { label: { ar: "الطلبات", en: "Orders" } },
          ]}
          chips={[
            { label: { ar: `${orders.length} طلب`, en: `${orders.length} orders` }, tone: "neutral" },
            { label: { ar: `${active} نشط`, en: `${active} active` }, tone: "primary" },
            { label: { ar: `${delivered} مكتمل`, en: `${delivered} delivered` }, tone: "success" },
            ...(refreshing ? [{ label: { ar: "جارٍ التحديث", en: "Refreshing" }, tone: "neutral" as const }] : []),
          ]}
          actions={
            <Link href="/merchant/orders/new">
              <Button variant="gold" size="md">
                {tx(locale, "إنشاء طلب جديد", "Create order")}
              </Button>
            </Link>
          }
        />

        <section className="panel-grid">
          <StatCard label={tx(locale, "كل الطلبات", "All orders")} value={orders.length} icon={<Package className="h-5 w-5" />} loading={loading} />
          <StatCard label={tx(locale, "الطلبات النشطة", "Active orders")} value={active} icon={<Radar className="h-5 w-5" />} accentColor="primary" loading={loading} />
          <StatCard label={tx(locale, "الطلبات المكتملة", "Delivered")} value={delivered} icon={<ArrowUpLeft className="h-5 w-5" />} accentColor="success" loading={loading} />
          <StatCard
            label={tx(locale, "إجمالي رسوم التوصيل", "Delivery fees")}
            value={revenue}
            suffix={locale === "ar" ? "ج.م" : "EGP"}
            icon={<Package className="h-5 w-5" />}
            accentColor="gold"
            loading={loading}
          />
        </section>

        <Card className="overflow-hidden space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="subtle-label">{tx(locale, "سجل الطلبات", "Operations list")}</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--text-primary)]">{tx(locale, "أحدث الطلبات", "Latest orders")}</h2>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {tx(locale, "مرتبة تلقائي من الأحدث للأقدم.", "Sorted automatically from newest to oldest.")}
            </div>
          </div>

          <DataTable
            data={orders}
            columns={columns}
            keyExtractor={(order) => order.id}
            loading={loading}
            emptyStateTitle={{ ar: "لا توجد طلبات بعد", en: "No orders yet" }}
            emptyStateMessage={{
              ar: "اعمل أول طلب من شاشة الطلب الجديد، وبعدها هتلاقي كل الطلبات هنا بتفاصيلها.",
              en: "Create your first order from the new flow and every order will show up here with its full details.",
            }}
          />
        </Card>
      </div>
    </PageShell>
  );
}
