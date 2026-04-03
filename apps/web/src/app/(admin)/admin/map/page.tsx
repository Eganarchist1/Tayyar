"use client";

import React from "react";
import { Radio, RefreshCw } from "lucide-react";
import { Button, Card, EmptyStateCard, PageHeader, PageShell, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedDateTime } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";
import MapLibreMap from "@/components/map/MapLibreMap";
import { orderStatusText, orderStatusTone } from "@/lib/order-status";

type AdminMapPayload = {
  heroes: Array<{
    id: string;
    status: string;
    currentLat?: number | null;
    currentLng?: number | null;
    user: { id: string; name: string; email: string };
    zone?: { id: string; name: string; nameAr?: string | null } | null;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    deliveryAddress?: string | null;
    requestedAt?: string;
    branch: { id: string; name: string; nameAr?: string | null; brandName: string; lat: number; lng: number };
    zone: { id: string; name: string; nameAr?: string | null };
    deliveryLat: number;
    deliveryLng: number;
    hero?: { id: string; name: string } | null;
  }>;
  zones: Array<{ id: string; name: string; nameAr?: string | null; boundaryWkt: string }>;
};

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) =>
  locale === "ar" ? ar || en || "--" : en || ar || "--";

function parseBoundaryWkt(boundaryWkt: string) {
  const cleaned = boundaryWkt.replace(/^POLYGON\s*\(\(/i, "").replace(/\)\)\s*$/i, "");
  return cleaned
    .split(",")
    .map((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return { lat, lng };
    })
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function heroStatusLabel(status: string) {
  if (status === "ONLINE") return { ar: "متصل", en: "Online" };
  if (status === "ON_DELIVERY") return { ar: "في مهمة", en: "On delivery" };
  return { ar: "غير متصل", en: "Offline" };
}

function heroStatusTone(status: string) {
  if (status === "ONLINE") return "success" as const;
  if (status === "ON_DELIVERY") return "primary" as const;
  return "neutral" as const;
}

export default function AdminMapPage() {
  const { locale } = useLocale();
  const [payload, setPayload] = React.useState<AdminMapPayload>({ heroes: [], orders: [], zones: [] });
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { lastMessage } = useSocket(["orders"]);

  const loadMap = React.useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const next = await apiFetch<AdminMapPayload>("/v1/admin/map/live", undefined, "ADMIN");
        setPayload(next);
        setError(null);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : tx(locale, "تعذر تحميل الخريطة المباشرة.", "Could not load the live map."),
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [locale],
  );

  React.useEffect(() => {
    void loadMap(true);
  }, [loadMap]);

  React.useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === "ORDER_STATUS_UPDATE" || lastMessage.type === "ORDER_CREATED") {
      void loadMap(false);
    }
  }, [lastMessage, loadMap]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadMap(false);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadMap]);

  const heroPoints = payload.heroes
    .filter((hero) => typeof hero.currentLat === "number" && typeof hero.currentLng === "number")
    .map((hero) => ({
      id: `hero-${hero.id}`,
      lat: hero.currentLat!,
      lng: hero.currentLng!,
      label: hero.user.name,
      color: "#0ea5e9",
    }));

  const orderPoints = payload.orders.map((order) => ({
    id: `order-${order.id}`,
    lat: order.deliveryLat,
    lng: order.deliveryLng,
    label: order.orderNumber,
    color: "#f59e0b",
  }));

  const branchPoints = Array.from(
    payload.orders.reduce((map, order) => {
      if (!map.has(order.branch.id)) {
        map.set(order.branch.id, {
          id: `branch-${order.branch.id}`,
          lat: order.branch.lat,
          lng: order.branch.lng,
          label: pickLabel(locale, order.branch.nameAr, order.branch.name),
          color: "#34d399",
        });
      }
      return map;
    }, new Map<string, { id: string; lat: number; lng: number; label: string; color: string }>()),
  ).map(([, point]) => point);

  const center = heroPoints[0] || orderPoints[0] || branchPoints[0] || { lat: 30.0444, lng: 31.2357 };
  const visibleHeroes = payload.heroes.filter((hero) => hero.currentLat !== null && hero.currentLng !== null);

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "الخريطة المباشرة", en: "Live map" }}
      pageSubtitle={{ ar: "حركة الطيارين والطلبات على مستوى المنصة.", en: "Live hero and order movement across the platform." }}
      showLive
      topbarActions={
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          loading={refreshing}
          onClick={() => void loadMap(false)}
        >
          {tx(locale, "تحديث", "Refresh")}
        </Button>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "الخريطة", en: "Map" }}
          title={{ ar: "حركة الشبكة الآن", en: "Network activity now" }}
          subtitle={{ ar: "تابع الطيارين والطلبات النشطة وحدود المناطق من شاشة واحدة.", en: "Track active heroes, orders, and zone boundaries from one screen." }}
          breadcrumbs={[
            { label: { ar: "الإدارة", en: "Admin" }, href: "/admin" },
            { label: { ar: "الخريطة", en: "Map" } },
          ]}
          chips={[
            { label: { ar: `${visibleHeroes.length} طيار ظاهر`, en: `${visibleHeroes.length} visible heroes` }, tone: "success" },
            { label: { ar: `${payload.orders.length} طلب نشط`, en: `${payload.orders.length} active orders` }, tone: "primary" },
            { label: { ar: `${payload.zones.length} منطقة`, en: `${payload.zones.length} zones` }, tone: "gold" },
            ...(refreshing ? [{ label: { ar: "جار التحديث", en: "Refreshing" }, tone: "neutral" as const }] : []),
          ]}
        />

        {error ? (
          <Card className="border-[var(--danger-500)] bg-[var(--danger-50)] text-[var(--danger-700)] dark:border-[var(--danger-600)] dark:bg-[var(--danger-900)] dark:text-[var(--danger-100)]">
            {error}
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.38fr_1fr]">
          <Card variant="elevated" className="space-y-4">
            <div>
              <p className="subtle-label">{tx(locale, "ملخص مباشر", "Live summary")}</p>
              <h2 className="mt-2 text-2xl font-black">{tx(locale, "الطيارون الظاهرون الآن", "Visible heroes right now")}</h2>
            </div>

            {payload.heroes.length ? (
              <div className="space-y-3">
                {payload.heroes.slice(0, 6).map((hero) => (
                  <div key={hero.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-text-primary">{hero.user.name}</div>
                        <div className="mt-1 text-xs text-text-tertiary">
                          {pickLabel(locale, hero.zone?.nameAr, hero.zone?.name) || tx(locale, "بدون منطقة", "No zone")}
                        </div>
                        <div className="mt-2 text-xs text-text-secondary">
                          {hero.currentLat !== null && hero.currentLng !== null
                            ? tx(locale, "الموقع الحي ظاهر على الخريطة", "Live position is visible on the map")
                            : tx(locale, "في الشبكة لكن بدون موقع حي", "In the network but no live position yet")}
                        </div>
                      </div>
                      <StatusPill label={heroStatusLabel(hero.status)} tone={heroStatusTone(hero.status)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyStateCard
                title={{ ar: "لا يوجد طيارون ظاهرون", en: "No heroes visible" }}
                description={{ ar: "جرّب التحديث أو افتح شاشة الأوامر لمعرفة آخر حالة تشغيل.", en: "Try refreshing or open the orders room to review the latest operating state." }}
              />
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="subtle-label">{tx(locale, "طبقة البث المباشر", "Live network layer")}</div>
                <div className="mt-1 text-xl font-black text-text-primary">
                  {tx(locale, `${visibleHeroes.length} طيار ظاهر - ${payload.orders.length} طلب نشط`, `${visibleHeroes.length} visible heroes - ${payload.orders.length} active orders`)}
                </div>
                <div className="mt-2 text-xs text-text-secondary">
                  {tx(locale, "تظهر مواقع الطيارين الحية، وعناوين التسليم، ونقاط الفروع الخاصة بالطلبات النشطة.", "Live hero positions, delivery addresses, and branch pickup points for active orders are shown.")}
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
                <Radio className="h-4 w-4" />
                {tx(locale, "البث شغال", "Feed connected")}
              </div>
            </div>

            {loading ? (
              <div className="h-[760px] animate-pulse rounded-[24px] border border-white/10 bg-white/[0.04]" />
            ) : payload.zones.length || heroPoints.length || orderPoints.length || branchPoints.length ? (
              <MapLibreMap
                center={center}
                zoom={12}
                points={[...branchPoints, ...orderPoints, ...heroPoints]}
                polygons={payload.zones
                  .map((zone) => parseBoundaryWkt(zone.boundaryWkt))
                  .filter((polygon) => polygon.length >= 3)}
                className="h-[760px]"
              />
            ) : (
              <EmptyStateCard
                title={{ ar: "لا توجد حركة على الخريطة الآن", en: "No live activity on the map" }}
                description={{ ar: "بمجرد ظهور طيارين أو طلبات نشطة سترى النقاط وحدود المناطق هنا.", en: "Hero positions, active orders, and zone boundaries will appear here as activity comes in." }}
              />
            )}

            <div className="grid gap-3 xl:grid-cols-2">
              {payload.orders.slice(0, 6).map((order) => (
                <div key={order.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-mono text-sm font-bold text-text-primary">{order.orderNumber}</div>
                      <div className="mt-1 text-sm text-text-secondary">{order.deliveryAddress || tx(locale, "بدون عنوان", "No address")}</div>
                      <div className="mt-2 text-xs text-text-tertiary">
                        {pickLabel(locale, order.zone.nameAr, order.zone.name)}
                        {" - "}
                        {pickLabel(locale, order.branch.nameAr, order.branch.name)}
                      </div>
                      <div className="mt-1 text-xs text-text-tertiary">
                        {formatLocalizedDateTime(order.requestedAt || new Date().toISOString(), locale)}
                      </div>
                    </div>
                    <StatusPill label={orderStatusText(order.status)} tone={orderStatusTone(order.status)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
