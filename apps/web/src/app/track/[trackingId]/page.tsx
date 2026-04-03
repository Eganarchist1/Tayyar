"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Button, Card, StatusPill, useLocale } from "@tayyar/ui";
import { Clock3, MapPin, Navigation, Phone, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  formatOrderTimestamp,
  merchantOrderTimeline,
  merchantTimelineStepForStatus,
  orderStatusText,
  orderStatusTone,
} from "@/lib/order-status";
import { useSocket } from "@/hooks/useSocket";

type TrackingPayload = {
  trackingId: string;
  orderNumber: string;
  status: string;
  requestedAt: string;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  deliveryAddress?: string | null;
  customerPhone: string;
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  branch: { name: string; address: string; phone?: string | null };
  hero: { name?: string | null; phone?: string | null; status: string; currentLat?: number | null; currentLng?: number | null } | null;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

export default function TrackingPage() {
  const { locale, direction } = useLocale();
  const params = useParams<{ trackingId: string }>();
  const trackingId = params?.trackingId;
  const [order, setOrder] = React.useState<TrackingPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const { lastMessage } = useSocket(["orders"]);

  const loadOrder = React.useCallback(
    async (showLoading: boolean) => {
      if (!trackingId) {
        return;
      }

      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const nextOrder = await apiFetch<TrackingPayload>(`/v1/orders/track/${trackingId}`);
        setOrder(nextOrder);
      } finally {
        if (showLoading) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [trackingId],
  );

  React.useEffect(() => {
    void loadOrder(true);
  }, [loadOrder]);

  React.useEffect(() => {
    if (!trackingId || !lastMessage || lastMessage.type !== "ORDER_STATUS_UPDATE") {
      return;
    }

    const payload = lastMessage.payload as { trackingId?: string } | undefined;
    if (payload?.trackingId === trackingId) {
      void loadOrder(false);
    }
  }, [lastMessage, loadOrder, trackingId]);

  const etaLabel =
    order?.status === "DELIVERED"
      ? tx(locale, "تم التسليم", "Delivered")
      : order?.status === "ARRIVED" || order?.status === "ARRIVED_DROPOFF"
        ? tx(locale, "وصل الطيار", "Hero arrived")
        : order?.status === "PICKED_UP" || order?.status === "ON_WAY" || order?.status === "IN_TRANSIT"
          ? tx(locale, "في الطريق إليك", "On the way to you")
          : tx(locale, "قيد التجهيز", "Preparing");

  const timeline = buildTimeline(order, locale);

  const openMaps = () => {
    if (!order) return;
    const lat = order.hero?.currentLat ?? order.deliveryLat;
    const lng = order.hero?.currentLng ?? order.deliveryLng;
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
  };

  const callHero = () => {
    const phone = order?.hero?.phone || order?.branch.phone;
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  const stagePointStyle = (offset: string, top: string) => (direction === "rtl" ? { right: offset, top } : { left: offset, top });
  const liveCardStyle = direction === "rtl" ? { right: "1.25rem", bottom: "1.25rem" } : { left: "1.25rem", bottom: "1.25rem" };

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-text-primary">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.15),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_30%)]" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(125,211,252,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.3) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-6 py-8 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card variant="elevated" className="min-h-[420px] overflow-hidden p-0">
            <div className="relative h-full min-h-[420px]">
              <div className="absolute inset-0 bg-[linear-gradient(160deg,#071019,#101c30)]" />
              <div
                className="absolute inset-0 opacity-[0.16]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.6), transparent 15%), radial-gradient(circle at 72% 60%, rgba(245,158,11,0.45), transparent 12%), radial-gradient(circle at 45% 78%, rgba(16,185,129,0.5), transparent 12%)",
                }}
              />
              <div className="absolute h-5 w-5 rounded-full bg-accent-500 shadow-[0_0_18px_rgba(245,158,11,0.7)]" style={stagePointStyle("28%", "28%")} />
              <div className="absolute h-5 w-5 rounded-full bg-primary-400 shadow-[0_0_18px_rgba(56,189,248,0.8)]" style={stagePointStyle("58%", "52%")} />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M62 30 C58 38, 50 46, 43 53 C39 57, 34 61, 30 68" fill="none" stroke="rgba(56,189,248,0.7)" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
              <div className="absolute rounded-[24px] border border-white/10 bg-[rgba(7,11,20,0.82)] px-4 py-3 backdrop-blur-xl" style={liveCardStyle}>
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-text-tertiary">{tx(locale, "تتبع مباشر", "Live tracking")}</div>
                <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
                  <Navigation className="h-4 w-4 text-primary-300" />
                  {etaLabel}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card variant="glass" className="space-y-5">
              <div className="flex justify-between gap-4" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="subtle-label">{tx(locale, "تتبع الطلب", "Order tracking")}</div>
                  <h1 className="mt-2 text-3xl font-black">{order?.orderNumber || `#${trackingId?.slice(0, 8)}`}</h1>
                  <p className="mt-2 text-sm text-text-secondary">
                    {order?.branch.name || tx(locale, "جارٍ تحميل بيانات الطلب", "Loading order details")}
                    {order ? " • " : ""}
                    {order?.deliveryAddress || tx(locale, "عنوان العميل", "Customer address")}
                  </p>
                </div>
                <StatusPill
                  label={
                    loading
                      ? tx(locale, "جارٍ التحميل", "Loading")
                      : refreshing
                        ? tx(locale, "جارٍ تحديث الحالة", "Refreshing status")
                        : orderStatusText(order?.status || "REQUESTED")
                  }
                  tone={loading || refreshing ? "neutral" : orderStatusTone(order?.status || "REQUESTED")}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/12">
                      <Navigation className="h-5 w-5 text-primary-300" />
                    </div>
                    <div>
                      <div className="font-bold">{order?.hero?.name || tx(locale, "سيتم التعيين", "Assignment pending")}</div>
                      <div className="mt-1 text-xs text-text-tertiary">{tx(locale, "الطيار المسؤول", "Assigned hero")}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500/12">
                      <Clock3 className="h-5 w-5 text-accent-300" />
                    </div>
                    <div>
                      <div className="font-bold">{etaLabel}</div>
                      <div className="mt-1 text-xs text-text-tertiary">{tx(locale, "آخر تحديث للحالة", "Latest status update")}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="gold" size="md" className="flex-1" onClick={callHero}>
                  <Phone className="h-4 w-4" />
                  {tx(locale, "اتصال", "Call")}
                </Button>
                <Button variant="secondary" size="md" className="flex-1" onClick={openMaps}>
                  <MapPin className="h-4 w-4" />
                  {tx(locale, "فتح الخريطة", "Open map")}
                </Button>
              </div>
            </Card>

            <Card className="space-y-5">
              <div>
                <div className="subtle-label">{tx(locale, "خطوات التوصيل", "Delivery steps")}</div>
                <h2 className="mt-2 text-2xl font-black">{tx(locale, "التقدم الحالي", "Current progress")}</h2>
              </div>
              <div className="space-y-4">
                {timeline.map((item) => (
                  <div key={item.label} className="flex gap-4" style={{ alignItems: "flex-start" }}>
                    <div
                      className={`mt-1 h-4 w-4 rounded-full ${
                        item.active
                          ? "bg-primary-400 shadow-[0_0_16px_rgba(56,189,248,0.8)]"
                          : item.done
                            ? "bg-emerald-400"
                            : "bg-white/10"
                      }`}
                    />
                    <div>
                      <div className={`font-bold ${item.active ? "text-text-primary" : item.done ? "text-text-secondary" : "text-text-tertiary"}`}>
                        {item.label}
                      </div>
                      {item.time ? <div className="mt-1 text-xs text-text-tertiary">{item.time}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-text-tertiary">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          {tx(locale, "تتبع مباشر وآمن عبر طيّار", "Secure live tracking powered by Tayyar")}
        </div>
      </div>
    </div>
  );
}

function buildTimeline(order: TrackingPayload | null, locale: "ar" | "en") {
  if (!order) {
    return [{ label: tx(locale, "جارٍ تحميل التسلسل", "Loading timeline"), active: true, done: false, time: undefined }];
  }

  const currentStep = merchantTimelineStepForStatus(order.status);
  const currentStepIndex = currentStep ? merchantOrderTimeline.indexOf(currentStep) : -1;
  const stepLabels: Record<(typeof merchantOrderTimeline)[number], string> = {
    REQUESTED: tx(locale, "تم إنشاء الطلب", "Order created"),
    ASSIGNED: tx(locale, "تأكيد التعيين", "Assignment confirmed"),
    PICKED_UP: tx(locale, "استلام من الفرع", "Picked up from branch"),
    ARRIVED: tx(locale, "في الطريق للعميل", "On the way to customer"),
    DELIVERED: tx(locale, "تم التسليم", "Delivered"),
  };
  const stepTimes: Partial<Record<(typeof merchantOrderTimeline)[number], string>> = {
    REQUESTED: formatOrderTimestamp(order.requestedAt, locale),
    PICKED_UP: order.pickedUpAt ? formatOrderTimestamp(order.pickedUpAt, locale) : undefined,
    DELIVERED: order.deliveredAt ? formatOrderTimestamp(order.deliveredAt, locale) : undefined,
  };

  return merchantOrderTimeline.map((step, index) => ({
    label: stepLabels[step],
    active: currentStep === step,
    done: currentStepIndex > index || (currentStep === step && step === "DELIVERED"),
    time: stepTimes[step],
  }));
}
