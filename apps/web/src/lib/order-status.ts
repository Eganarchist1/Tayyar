import type { LocalizedText } from "@tayyar/ui";
import { formatLocalizedDateTime, type AppLocale } from "@tayyar/utils";

export type OrderTone = "primary" | "gold" | "success" | "neutral";

const STATUS_TEXT: Record<string, LocalizedText> = {
  REQUESTED: { ar: "تم استلام الطلب", en: "Order received" },
  ASSIGNED: { ar: "تم تعيين الطيار", en: "Hero assigned" },
  HERO_ACCEPTED: { ar: "الطيار قبل المهمة", en: "Hero accepted" },
  ARRIVED_PICKUP: { ar: "وصل إلى نقطة الاستلام", en: "At pickup" },
  PICKED_UP: { ar: "تم الاستلام", en: "Picked up" },
  ON_WAY: { ar: "في الطريق", en: "On the way" },
  IN_TRANSIT: { ar: "في الطريق", en: "On the way" },
  ARRIVED_DROPOFF: { ar: "وصل إلى العميل", en: "At customer" },
  ARRIVED: { ar: "وصل إلى العميل", en: "At customer" },
  DELIVERED: { ar: "تم التسليم", en: "Delivered" },
  FAILED: { ar: "تعذر التسليم", en: "Delivery failed" },
  CANCELLED: { ar: "تم إلغاء الطلب", en: "Cancelled" },
};

export const merchantOrderTimeline = [
  "REQUESTED",
  "ASSIGNED",
  "PICKED_UP",
  "ARRIVED",
  "DELIVERED",
] as const;

export type MerchantTimelineStep = (typeof merchantOrderTimeline)[number];

const merchantTimelineStepStatuses: Record<MerchantTimelineStep, string[]> = {
  REQUESTED: ["REQUESTED"],
  ASSIGNED: ["ASSIGNED", "HERO_ACCEPTED", "ARRIVED_PICKUP"],
  PICKED_UP: ["PICKED_UP", "ON_WAY", "IN_TRANSIT"],
  ARRIVED: ["ARRIVED", "ARRIVED_DROPOFF"],
  DELIVERED: ["DELIVERED"],
};

export function merchantTimelineStatuses(step: MerchantTimelineStep) {
  return merchantTimelineStepStatuses[step];
}

export function merchantTimelineStepForStatus(status: string): MerchantTimelineStep | null {
  const entry = Object.entries(merchantTimelineStepStatuses).find(([, statuses]) => statuses.includes(status));
  return (entry?.[0] as MerchantTimelineStep | undefined) || null;
}

export function merchantTimelineStepIndex(status: string) {
  const step = merchantTimelineStepForStatus(status);
  return step ? merchantOrderTimeline.indexOf(step) : -1;
}

export function orderStatusText(status: string): LocalizedText {
  return STATUS_TEXT[status] || { ar: status, en: status };
}

export function orderStatusTone(status: string): OrderTone {
  if (status === "DELIVERED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "gold";
  if (
    status === "REQUESTED" ||
    status === "ASSIGNED" ||
    status === "HERO_ACCEPTED" ||
    status === "ARRIVED_PICKUP" ||
    status === "PICKED_UP" ||
    status === "ON_WAY" ||
    status === "IN_TRANSIT" ||
    status === "ARRIVED_DROPOFF" ||
    status === "ARRIVED"
  ) {
    return "primary";
  }
  return "neutral";
}

export function formatOrderTimestamp(value: string | null | undefined, locale: AppLocale) {
  if (!value) {
    return locale === "ar" ? "قيد الانتظار" : "Pending";
  }

  return formatLocalizedDateTime(value, locale);
}
