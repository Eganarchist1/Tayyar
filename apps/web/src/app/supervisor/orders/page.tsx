"use client";

import React from "react";
import { Button, Card, PageHeader, PageShell, StatusPill, text, useLocale } from "@tayyar/ui";
import { formatLocalizedDateTime } from "@tayyar/utils";
import type { OperationalAlertItem } from "@tayyar/types";
import { apiFetch } from "@/lib/api";
import { orderStatusText, orderStatusTone } from "@/lib/order-status";
import { localizeAlertMessage, localizeAlertTitle } from "@/lib/ops";
import { useSocket } from "@/hooks/useSocket";

type ActiveOrder = {
  id: string;
  orderNumber: string;
  status: string;
  zoneId?: string;
  heroId?: string | null;
  branch?: { name?: string | null };
  deliveryAddress?: string | null;
  hero?: {
    user?: {
      name?: string | null;
    } | null;
  } | null;
  eligibleHeroes: Array<{
    heroId: string;
    name: string;
    distanceKm: number;
    activeOrders: number;
    assignmentReason: "DEDICATED_BRANCH" | "NEAREST_IN_ZONE";
    zoneName?: string | null;
    zoneNameAr?: string | null;
  }>;
};

type AlertRecord = OperationalAlertItem;

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const alertTone = (severity: string): "primary" | "gold" | "neutral" =>
  severity === "high" ? "primary" : severity === "medium" ? "gold" : "neutral";
const distanceLabel = (locale: "ar" | "en", value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}${tx(locale, " كم", " km")}` : tx(locale, "بانتظار الموقع الحي", "Awaiting live location");

export default function SupervisorOrdersPage() {
  const { locale } = useLocale();
  const [orders, setOrders] = React.useState<ActiveOrder[]>([]);
  const [alerts, setAlerts] = React.useState<AlertRecord[]>([]);
  const [selectedHero, setSelectedHero] = React.useState<Record<string, string>>({});
  const selectedHeroRef = React.useRef<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [assigningOrderId, setAssigningOrderId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "gold"; message: string } | null>(null);
  const { lastMessage } = useSocket(["orders"]);

  const loadData = React.useCallback(async (showLoading: boolean) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [ordersData, alertsData] = await Promise.all([
        apiFetch<ActiveOrder[]>("/v1/supervisors/orders/active", undefined, "SUPERVISOR"),
        apiFetch<AlertRecord[]>("/v1/supervisors/alerts", undefined, "SUPERVISOR"),
      ]);
      setOrders(ordersData);
      setAlerts(alertsData);
      setSelectedHero((current) => {
        const next = { ...current };
        for (const order of ordersData) {
          if (!next[order.id] && order.heroId) {
            next[order.id] = order.heroId;
          }
        }
        selectedHeroRef.current = next;
        return next;
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadData(true);
  }, [loadData]);

  React.useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "ORDER_STATUS_UPDATE" || lastMessage.type === "ORDER_CREATED") {
      void loadData(false);
    }
  }, [lastMessage, loadData]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData(false);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const shellNotifications = React.useMemo(
    () =>
      alerts.slice(0, 4).map((alert) => ({
        id: alert.id,
        title: localizeAlertTitle(alert, locale),
        description: localizeAlertMessage(alert, locale),
        href: alert.actionHref || "/supervisor/alerts",
        tone: alertTone(alert.severity),
        meta: formatLocalizedDateTime(alert.createdAt, locale),
      })),
    [alerts, locale],
  );

  async function handleAssign(order: ActiveOrder) {
    const heroId = selectedHeroRef.current[order.id];
    if (!heroId) {
      setFeedback({ tone: "gold", message: tx(locale, "اختر طيارًا أولًا.", "Select a hero first.") });
      return;
    }

    setAssigningOrderId(order.id);
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/supervisors/orders/${order.id}/reassign`,
        {
          method: "PATCH",
          body: JSON.stringify({ heroId }),
        },
        "SUPERVISOR",
      );

      await loadData(false);
      setFeedback({ tone: "success", message: tx(locale, "تم تحديث إسناد الطلب.", "Order assignment updated.") });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر تحديث الإسناد.", "Could not update assignment."),
      });
    } finally {
      setAssigningOrderId(null);
    }
  }

  return (
    <PageShell
      role="SUPERVISOR"
      notifications={shellNotifications}
      notificationsLoading={loading}
      user={{ name: text("مشرف المنطقة", "Zone supervisor"), email: "supervisor@tayyar.app" }}
      pageTitle={text("الطلبات النشطة", "Active orders")}
      pageSubtitle={text("تابع الطلبات وحدد الطيار المناسب من نفس الشاشة.", "Review orders and assign the right hero from the same screen.")}
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={text("الطلبات", "Orders")}
          title={text("غرفة الطلبات", "Orders room")}
          subtitle={text("راجع ما يتحرك الآن وغير الإسناد عند الحاجة.", "Review what is moving now and reassign when needed.")}
          breadcrumbs={[
            { label: text("الإشراف", "Supervisor"), href: "/supervisor/map" },
            { label: text("الطلبات", "Orders") },
          ]}
          chips={[
            { label: { ar: `${orders.length} طلب نشط`, en: `${orders.length} active orders` }, tone: "primary" },
            {
              label: {
                ar: `${orders.reduce((sum, order) => sum + order.eligibleHeroes.length, 0)} خيار إسناد`,
                en: `${orders.reduce((sum, order) => sum + order.eligibleHeroes.length, 0)} assignment options`,
              },
              tone: "success",
            },
            ...(refreshing ? [{ label: { ar: "جار التحديث", en: "Refreshing" }, tone: "neutral" as const }] : []),
          ]}
        />

        {feedback ? (
          <div
            className={`rounded-[24px] border px-5 py-4 text-sm font-bold ${
              feedback.tone === "success"
                ? "border-[var(--success-500)] bg-[var(--success-50)] text-[var(--success-700)] dark:border-[var(--success-600)] dark:bg-[var(--success-900)] dark:text-[var(--success-100)]"
                : "border-[var(--danger-500)] bg-[var(--danger-50)] text-[var(--danger-700)] dark:border-[var(--danger-600)] dark:bg-[var(--danger-900)] dark:text-[var(--danger-100)]"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {orders.map((order) => (
            <Card key={order.id} className="space-y-5 transition-shadow hover:shadow-[var(--shadow-lg)] border-[var(--border-default)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-[var(--text-primary)]">{order.orderNumber}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    {order.branch?.name || tx(locale, "بدون فرع", "No branch")}
                    {" - "}
                    {order.deliveryAddress || tx(locale, "بدون عنوان", "No address")}
                  </div>
                  <div className="mt-2 text-xs font-bold text-[var(--text-tertiary)]">
                    {tx(locale, "الإسناد الحالي", "Current assignment")}:{" "}
                    <span className="text-[var(--text-primary)] font-medium">
                      {order.hero?.user?.name || tx(locale, "بدون طيار", "No hero")}
                    </span>
                  </div>
                </div>
                <StatusPill label={orderStatusText(order.status)} tone={orderStatusTone(order.status)} />
              </div>

              <div className="space-y-3 rounded-[20px] bg-[var(--bg-surface-2)] border border-[var(--border-default)] p-4">
                <label className="block app-font-body text-sm font-bold text-[var(--text-primary)]">
                  {tx(locale, "اختر الطيار", "Select hero")}
                </label>
                <div className="text-xs text-[var(--text-secondary)]">
                  {order.eligibleHeroes.length
                    ? tx(locale, "الاختيارات مرتبة حسب التخصيص ثم الأقرب بالكيلومتر.", "Choices are ranked by branch dedication first, then nearest by km.")
                    : tx(locale, "لا يوجد طيارون مؤهلون داخل هذا النطاق الآن.", "There are no eligible heroes in this scope right now.")}
                </div>
                <select
                  className="h-12 w-full rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--primary-300)]"
                  value={selectedHero[order.id] || ""}
                  onChange={(event) => {
                    const nextHeroId = event.target.value;
                    selectedHeroRef.current = {
                      ...selectedHeroRef.current,
                      [order.id]: nextHeroId,
                    };
                    setSelectedHero((current) => ({
                      ...current,
                      [order.id]: nextHeroId,
                    }));
                  }}
                >
                  <option value="">{tx(locale, "اختر من القائمة", "Choose from the list")}</option>
                  {order.eligibleHeroes.map((hero) => (
                    <option key={hero.heroId} value={hero.heroId}>
                      {hero.name}
                      {" - "}
                      {hero.assignmentReason === "DEDICATED_BRANCH"
                        ? tx(locale, "مخصص للفرع", "Dedicated branch")
                        : tx(locale, "الأقرب في النطاق", "Nearest in zone")}
                      {" - "}
                      {distanceLabel(locale, hero.distanceKm)}
                    </option>
                  ))}
                </select>

                <div className="grid gap-3 md:grid-cols-2">
                  {order.eligibleHeroes.slice(0, 2).map((hero) => (
                    <div key={`${order.id}-${hero.heroId}`} className="rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3">
                      <div className="font-bold text-[var(--text-primary)]">{hero.name}</div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {hero.assignmentReason === "DEDICATED_BRANCH"
                          ? tx(locale, "مخصص لهذا الفرع", "Dedicated to this branch")
                          : tx(locale, "الأقرب داخل النطاق", "Nearest inside the zone")}
                      </div>
                      <div className="mt-2 text-xs font-mono text-[var(--text-tertiary)]">
                        {distanceLabel(locale, hero.distanceKm)}
                        {" - "}
                        {hero.activeOrders} {tx(locale, "طلبات نشطة", "active orders")}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="gold"
                  fullWidth
                  loading={assigningOrderId === order.id}
                  onClick={() => void handleAssign(order)}
                  disabled={!order.eligibleHeroes.length}
                >
                  {tx(locale, "تحديث الإسناد", "Update assignment")}
                </Button>
              </div>
            </Card>
          ))}

          {!loading && !orders.length ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-default)] px-5 py-10 text-center text-sm text-[var(--text-secondary)] col-span-full">
              {tx(locale, "لا توجد طلبات نشطة داخل نطاقك الآن.", "There are no active orders in your scope right now.")}
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
