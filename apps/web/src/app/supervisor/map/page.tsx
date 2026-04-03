"use client";

import React from "react";
import { Radio, Search } from "lucide-react";
import { Card, InputWithIcon, PageHeader, PageShell, StatusPill, useLocale } from "@tayyar/ui";
import { useSocket } from "@/hooks/useSocket";
import { apiFetch } from "@/lib/api";
import { orderStatusText, orderStatusTone } from "@/lib/order-status";
import MapLibreMap from "@/components/map/MapLibreMap";

type HeroRecord = {
  id: string;
  status?: string;
  user?: { name?: string };
  zone?: { name?: string; nameAr?: string };
  currentLat?: number | null;
  currentLng?: number | null;
};

type OrderRecord = {
  id: string;
  orderNumber: string;
  status: string;
  branch?: { name?: string; nameAr?: string; lat?: number; lng?: number };
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
};

type ZoneRecord = { id: string; name?: string; nameAr?: string; boundaryWkt: string };
type LiveHeroesPayload = { heroes: HeroRecord[]; zones: ZoneRecord[] };
type LocationUpdatePayload = { heroId: string; lat: number; lng: number; status?: string };
type OrderStatusUpdatePayload = { orderId: string; status: string };

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) => (locale === "ar" ? ar || en || "--" : en || ar || "--");

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

export default function SupervisorMapPage() {
  const { locale } = useLocale();
  const [activeTab, setActiveTab] = React.useState<"heroes" | "orders">("heroes");
  const [query, setQuery] = React.useState("");
  const [heroes, setHeroes] = React.useState<HeroRecord[]>([]);
  const [orders, setOrders] = React.useState<OrderRecord[]>([]);
  const [zones, setZones] = React.useState<ZoneRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { isConnected, lastMessage, connectionState, retryCount } = useSocket();

  const loadData = React.useCallback(async () => {
    const [heroPayload, ordersData] = await Promise.all([
      apiFetch<LiveHeroesPayload>("/v1/supervisors/map/live", undefined, "SUPERVISOR"),
      apiFetch<OrderRecord[]>("/v1/supervisors/orders/active", undefined, "SUPERVISOR"),
    ]);
    setHeroes(heroPayload.heroes);
    setZones(heroPayload.zones);
    setOrders(ordersData);
  }, []);

  React.useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [loadData]);

  React.useEffect(() => {
    if (lastMessage?.type === "LOCATION_UPDATE") {
      const payload = lastMessage.payload as LocationUpdatePayload;
      setHeroes((prev) =>
        prev.map((hero) =>
          hero.id === payload.heroId ? { ...hero, currentLat: payload.lat, currentLng: payload.lng, status: payload.status || hero.status } : hero,
        ),
      );
    }

    if (lastMessage?.type === "ORDER_STATUS_UPDATE") {
      const payload = lastMessage.payload as OrderStatusUpdatePayload;
      setOrders((prev) => prev.map((order) => (order.id === payload.orderId ? { ...order, status: payload.status } : order)));
    }
  }, [lastMessage]);

  const filteredHeroes = heroes.filter((hero) => `${hero.user?.name || ""} ${hero.zone?.nameAr || hero.zone?.name || ""}`.toLowerCase().includes(query.toLowerCase()));
  const filteredOrders = orders.filter((order) => `${order.orderNumber} ${order.deliveryAddress || ""}`.toLowerCase().includes(query.toLowerCase()));

  const heroPoints = filteredHeroes
    .filter((hero) => typeof hero.currentLat === "number" && typeof hero.currentLng === "number")
    .map((hero) => ({
      id: `hero-${hero.id}`,
      lat: hero.currentLat!,
      lng: hero.currentLng!,
      label: hero.user?.name || hero.id,
      color: "#0ea5e9",
    }));
  const orderPoints = filteredOrders
    .filter((order) => typeof order.deliveryLat === "number" && typeof order.deliveryLng === "number")
    .map((order) => ({
      id: `order-${order.id}`,
      lat: order.deliveryLat!,
      lng: order.deliveryLng!,
      label: order.orderNumber,
      color: "#f59e0b",
    }));
  const center = heroPoints[0] || orderPoints[0] || { lat: 30.0444, lng: 31.2357 };

  return (
    <PageShell
      role="SUPERVISOR"
      user={{ name: { ar: "مشرف المنطقة", en: "Zone supervisor" }, email: "supervisor@tayyar.app" }}
      pageTitle={{ ar: "لوحة الإشراف", en: "Field control desk" }}
      pageSubtitle={{ ar: "الطيارون والطلبات داخل نطاقك.", en: "Heroes and active orders in your assigned zone." }}
      showLive
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow={{ ar: "الإشراف", en: "Supervisor" }}
          title={{ ar: "الخريطة المباشرة", en: "Live zone map" }}
          subtitle={{ ar: "راجع حركة الطيارين والطلبات وحالة الاتصال.", en: "Track hero movement, orders, and connection state." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/supervisor/map" },
            { label: { ar: "الخريطة المباشرة", en: "Live map" } },
          ]}
          chips={[
            { label: { ar: `${filteredHeroes.length} طيار`, en: `${filteredHeroes.length} heroes` }, tone: "success" },
            { label: { ar: `${filteredOrders.length} طلب نشط`, en: `${filteredOrders.length} active orders` }, tone: "primary" },
            {
              label:
                connectionState === "connected"
                  ? { ar: "البث متصل", en: "Live feed connected" }
                  : connectionState === "reconnecting" || connectionState === "connecting"
                    ? { ar: `إعادة اتصال${retryCount ? ` (${retryCount})` : ""}`, en: `Reconnecting${retryCount ? ` (${retryCount})` : ""}` }
                    : { ar: "البث غير متصل", en: "Live feed offline" },
              tone: connectionState === "connected" ? "success" : connectionState === "disconnected" ? "gold" : "primary",
            },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[0.38fr_1fr]">
          <Card variant="elevated" className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="subtle-label">{tx(locale, "لوحة المتابعة", "Control panel")}</p>
                <h2 className="mt-2 text-xl font-black">{tx(locale, "الحركة المباشرة", "Live activity")}</h2>
              </div>
              <StatusPill label={isConnected ? { ar: "متصل", en: "Connected" } : { ar: "غير متصل", en: "Offline" }} tone={isConnected ? "success" : "gold"} />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-white/8 bg-white/[0.03] p-1">
              <button type="button" onClick={() => setActiveTab("heroes")} className={activeTab === "heroes" ? "rounded-[18px] bg-primary-500/14 px-4 py-3 text-sm font-bold text-primary-200" : "rounded-[18px] px-4 py-3 text-sm font-bold text-text-secondary"}>
                {tx(locale, "الطيارون", "Heroes")}
              </button>
              <button type="button" onClick={() => setActiveTab("orders")} className={activeTab === "orders" ? "rounded-[18px] bg-primary-500/14 px-4 py-3 text-sm font-bold text-primary-200" : "rounded-[18px] px-4 py-3 text-sm font-bold text-text-secondary"}>
                {tx(locale, "الطلبات", "Orders")}
              </button>
            </div>

            <InputWithIcon
              icon={<Search className="h-4 w-4" />}
              placeholder={tx(locale, "ابحث بالاسم أو رقم الطلب", "Search by name or order number")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="max-h-[520px] space-y-3 overflow-y-auto">
              {activeTab === "heroes"
                ? filteredHeroes.map((hero) => (
                    <div key={hero.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-text-primary">{hero.user?.name || hero.id}</div>
                          <div className="mt-1 text-sm text-text-secondary">{pickLabel(locale, hero.zone?.nameAr, hero.zone?.name) || tx(locale, "بدون منطقة", "No zone")}</div>
                        </div>
                        <StatusPill
                          label={hero.status === "ONLINE" ? { ar: "متاح", en: "Online" } : hero.status === "ON_DELIVERY" ? { ar: "في مهمة", en: "On delivery" } : { ar: "غير متصل", en: "Offline" }}
                          tone={hero.status === "ONLINE" ? "success" : hero.status === "ON_DELIVERY" ? "primary" : "neutral"}
                        />
                      </div>
                    </div>
                  ))
                : filteredOrders.map((order) => (
                    <div key={order.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-text-primary">{order.orderNumber}</div>
                          <div className="mt-1 text-sm text-text-secondary">{`${pickLabel(locale, order.branch?.nameAr, order.branch?.name)} - ${order.deliveryAddress || tx(locale, "بدون عنوان", "No address")}`}</div>
                        </div>
                        <StatusPill label={orderStatusText(order.status)} tone={orderStatusTone(order.status)} />
                      </div>
                    </div>
                  ))}
              {!loading && ((activeTab === "heroes" && !filteredHeroes.length) || (activeTab === "orders" && !filteredOrders.length)) ? (
                <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-6 text-sm text-text-secondary">{tx(locale, "لا توجد نتائج مطابقة.", "No matching results.")}</div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="subtle-label">{tx(locale, "بث الإشراف", "Supervisor live feed")}</div>
                <div className="mt-1 text-lg font-black text-text-primary">{tx(locale, `${filteredHeroes.length} طيار - ${filteredOrders.length} طلب نشط`, `${filteredHeroes.length} heroes - ${filteredOrders.length} active orders`)}</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-text-secondary">
                <Radio className={`h-4 w-4 ${isConnected ? "text-emerald-300" : connectionState === "reconnecting" ? "text-amber-300" : "text-red-300"}`} />
                {isConnected ? tx(locale, "البث متصل", "Live feed connected") : connectionState === "reconnecting" ? tx(locale, `إعادة اتصال (${retryCount})`, `Reconnecting (${retryCount})`) : tx(locale, "الاتصال غير متاح", "Connection unavailable")}
              </div>
            </div>
            <MapLibreMap
              center={center}
              zoom={12}
              points={[...heroPoints, ...orderPoints]}
              polygons={zones.map((zone) => parseBoundaryWkt(zone.boundaryWkt))}
              className="h-[720px]"
            />
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
