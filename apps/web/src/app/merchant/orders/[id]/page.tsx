"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowUpRight, MapPinned, Package, Phone, Rocket, Store, Truck } from "lucide-react";
import { Button, Card, EmptyStateCard, PageHeader, PageShell, StatusPill, useLocale } from "@tayyar/ui";
import type { MerchantOrderDetail } from "@tayyar/types";
import { apiFetch } from "@/lib/api";
import {
  formatOrderTimestamp,
  merchantOrderTimeline,
  merchantTimelineStatuses,
  merchantTimelineStepForStatus,
  orderStatusText,
  orderStatusTone,
} from "@/lib/order-status";
import { useSocket } from "@/hooks/useSocket";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) =>
  locale === "ar" ? ar || en || "--" : en || ar || "--";

export default function MerchantOrderDetailPage() {
  const { locale } = useLocale();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = React.useState<MerchantOrderDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { lastMessage } = useSocket(["orders"]);

  const loadOrder = React.useCallback(
    async (showLoading: boolean) => {
      if (!params?.id) {
        return;
      }

      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const nextOrder = await apiFetch<MerchantOrderDetail>(`/v1/merchants/orders/${params.id}`);
        setOrder(nextOrder);
      } catch (err) {
        setError(err instanceof Error ? err.message : tx(locale, "تعذر تحميل الطلب.", "Could not load the order."));
      } finally {
        if (showLoading) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [locale, params?.id],
  );

  React.useEffect(() => {
    void loadOrder(true);
  }, [loadOrder]);

  React.useEffect(() => {
    if (!order || !lastMessage || lastMessage.type !== "ORDER_STATUS_UPDATE") {
      return;
    }

    const payload = lastMessage.payload as { orderId?: string; trackingId?: string } | undefined;
    if (payload?.orderId === order.id || payload?.trackingId === order.trackingId) {
      void loadOrder(false);
    }
  }, [lastMessage, loadOrder, order]);

  const currentTimelineStep = merchantTimelineStepForStatus(order?.status || "");
  const currentTimelineIndex = currentTimelineStep ? merchantOrderTimeline.indexOf(currentTimelineStep) : -1;

  const timeline = merchantOrderTimeline.map((status) => {
    const matchingStatuses = merchantTimelineStatuses(status);
    const history = order?.statusHistory
      .slice()
      .reverse()
      .find((item) => matchingStatuses.includes(item.status));
    const stepIndex = merchantOrderTimeline.indexOf(status);

    return {
      status,
      history,
      done: Boolean(history) || currentTimelineIndex > stepIndex || order?.status === "DELIVERED",
      active: currentTimelineStep === status,
    };
  });

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "تفاصيل الطلب", en: "Order details" }}
      pageSubtitle={{ ar: "صفحة واحدة للعميل والحالة والطيار والتتبع.", en: "One place for customer, status, hero, and tracking." }}
      showLive
      topbarActions={
        <>
          {order ? (
            <Link href={`/track/${order.trackingId}`}>
              <Button variant="secondary" size="sm" icon={<Truck className="h-4 w-4" />}>
                {tx(locale, "فتح التتبع", "Open tracking")}
              </Button>
            </Link>
          ) : null}
          <Link href="/merchant/orders/new">
            <Button variant="gold" size="sm" icon={<Rocket className="h-4 w-4" />}>
              {tx(locale, "طلب جديد", "New order")}
            </Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow={{ ar: "الطلبات", en: "Orders" }}
          title={{ ar: order ? `الطلب ${order.orderNumber}` : "تفاصيل الطلب", en: order ? `Order ${order.orderNumber}` : "Order details" }}
          subtitle={{ ar: "راجع التسلسل التشغيلي كامل من تسجيل الطلب لحد التسليم.", en: "Review the full operating sequence from order creation to delivery." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "الطلبات", en: "Orders" }, href: "/merchant/orders" },
            { label: { ar: "تفاصيل الطلب", en: "Order details" } },
          ]}
          chips={
            order
              ? [
                  { label: orderStatusText(order.status), tone: orderStatusTone(order.status) },
                  ...(refreshing
                    ? [{ label: { ar: "جارٍ تحديث الحالة", en: "Refreshing status" }, tone: "neutral" as const }]
                    : []),
                ]
              : undefined
          }
        />

        {error ? <Card className="border border-danger-500/20 bg-danger-500/10 text-red-100">{error}</Card> : null}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
            <Card className="h-72 animate-pulse bg-white/[0.04]" />
          </div>
        ) : null}

        {!loading && !order ? (
          <EmptyStateCard
            title={{ ar: "الطلب غير موجود", en: "Order not found" }}
            description={{ ar: "راجع رقم الطلب أو ارجع لسجل الطلبات.", en: "Check the order reference or go back to the orders list." }}
            action={
              <Link href="/merchant/orders">
                <Button variant="gold">{tx(locale, "رجوع للطلبات", "Back to orders")}</Button>
              </Link>
            }
          />
        ) : null}

        {!loading && order ? (
          <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
            <div className="space-y-6">
              <Card variant="elevated" className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card padding="sm" className="bg-white/[0.03]">
                    <div className="app-font-body text-xs text-text-tertiary">{tx(locale, "رقم الطلب", "Order number")}</div>
                    <div className="mt-2 font-mono text-lg font-black">{order.orderNumber}</div>
                  </Card>
                  <Card padding="sm" className="bg-white/[0.03]">
                    <div className="app-font-body text-xs text-text-tertiary">{tx(locale, "رقم التتبع", "Tracking ID")}</div>
                    <div className="mt-2 font-mono text-lg font-black">{order.trackingId}</div>
                  </Card>
                  <Card padding="sm" className="bg-white/[0.03]">
                    <div className="app-font-body text-xs text-text-tertiary">{tx(locale, "وقت الإنشاء", "Requested at")}</div>
                    <div className="mt-2 text-sm font-bold text-text-primary">{formatOrderTimestamp(order.requestedAt, locale)}</div>
                  </Card>
                  <Card padding="sm" className="bg-white/[0.03]">
                    <div className="app-font-body text-xs text-text-tertiary">{tx(locale, "رسوم التوصيل", "Delivery fee")}</div>
                    <div className="mt-2 text-sm font-bold text-text-primary">{locale === "ar" ? `${order.deliveryFee ?? 0} ج.م` : `EGP ${order.deliveryFee ?? 0}`}</div>
                  </Card>
                </div>
                <div className="flex flex-wrap gap-3">
                  <StatusPill label={orderStatusText(order.status)} tone={orderStatusTone(order.status)} />
                  {order.hero?.user?.name ? (
                    <StatusPill label={{ ar: `الطيار: ${order.hero.user.name}`, en: `Hero: ${order.hero.user.name}` }} tone="primary" />
                  ) : (
                    <StatusPill label={{ ar: "لسه مفيش طيار متسند", en: "Hero assignment pending" }} tone="gold" />
                  )}
                </div>
              </Card>

              <Card className="space-y-4">
                <div>
                  <p className="subtle-label">{tx(locale, "العميل والعنوان", "Customer and address")}</p>
                  <h2 className="app-font-display mt-2 text-xl font-black">{order.customerName || tx(locale, "عميل جديد", "New customer")}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <Phone className="h-4 w-4" />
                      {tx(locale, "رقم العميل", "Customer phone")}
                    </div>
                    <div className="font-mono text-sm text-text-secondary">{order.customerPhone}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <MapPinned className="h-4 w-4" />
                      {tx(locale, "عنوان التوصيل", "Delivery address")}
                    </div>
                    <div className="text-sm text-text-secondary">{order.deliveryAddress || order.customerAddress?.addressLabel || "--"}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <Store className="h-4 w-4" />
                      {tx(locale, "الفرع", "Branch")}
                    </div>
                    <div className="text-sm text-text-secondary">{pickLabel(locale, order.branch.nameAr, order.branch.name)}</div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                      <Package className="h-4 w-4" />
                      {tx(locale, "المنطقة", "Zone")}
                    </div>
                    <div className="text-sm text-text-secondary">{pickLabel(locale, order.zone.nameAr, order.zone.name)}</div>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="subtle-label">{tx(locale, "تسلسل التنفيذ", "Execution timeline")}</p>
                  <h2 className="app-font-display mt-2 text-xl font-black">{tx(locale, "حالة الطلب خطوة بخطوة", "Order status step by step")}</h2>
                </div>
                <Link href={`/track/${order.trackingId}`} className="text-sm font-bold text-primary-300">
                  <span className="inline-flex items-center gap-2">
                    {tx(locale, "التتبع العام", "Public tracking")}
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
              <div className="space-y-3">
                {timeline.map((item) => (
                  <div
                    key={item.status}
                    className={`rounded-[24px] border p-4 ${
                      item.active
                        ? "border-primary-500/24 bg-primary-500/10"
                        : item.done
                          ? "border-emerald-500/18 bg-emerald-500/8"
                          : "border-white/8 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="app-font-body font-bold text-text-primary">
                          {locale === "ar" ? orderStatusText(item.status).ar : orderStatusText(item.status).en}
                        </div>
                        <div className="mt-1 text-sm text-text-secondary">
                          {item.history ? formatOrderTimestamp(item.history.createdAt, locale) : tx(locale, "لسه", "Pending")}
                        </div>
                      </div>
                      <StatusPill
                        label={
                          item.active
                            ? { ar: "الحالة الحالية", en: "Current" }
                            : item.done
                              ? { ar: "تمت", en: "Done" }
                              : { ar: "منتظر", en: "Waiting" }
                        }
                        tone={item.active ? "primary" : item.done ? "success" : "neutral"}
                      />
                    </div>
                    {item.history?.note ? <div className="mt-3 text-sm text-text-secondary">{item.history.note}</div> : null}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
