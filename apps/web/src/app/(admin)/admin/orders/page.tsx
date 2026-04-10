"use client";

import React from "react";
import Link from "next/link";
import { Button, Card, Input, PageHeader, PageShell, Select, StatusPill, useLocale } from "@tayyar/ui";
import { formatLocalizedCurrency, formatLocalizedDateTime } from "@tayyar/utils";
import { apiFetch } from "@/lib/api";
import { orderStatusText, orderStatusTone } from "@/lib/order-status";
import { useSocket } from "@/hooks/useSocket";

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  deliveryFee?: number | null;
  requestedAt: string;
  deliveredAt?: string | null;
  deliveryAddress?: string | null;
  customerName?: string | null;
  customerPhone: string;
  heroId?: string | null;
  branch: {
    id: string;
    name: string;
    nameAr?: string | null;
    brandName: string;
  };
  hero?: { id: string; name: string } | null;
  zone: { id: string; name: string; nameAr?: string | null };
  eligibleHeroes: Array<{
    id: string;
    userId: string;
    name: string;
    phone?: string | null;
    status: string;
    distanceKm: number;
    activeOrders: number;
    ordersToday?: number;
    assignmentReason: "DEDICATED_BRANCH" | "NEAREST_IN_ZONE";
    zone: { id?: string | null; name?: string | null; nameAr?: string | null };
  }>;
};

type BranchRecord = {
  id: string;
  name: string;
  nameAr?: string | null;
  merchant: {
    id: string;
    name: string;
    nameAr?: string | null;
  };
};

type ZoneRecord = {
  id: string;
  name: string;
  nameAr?: string | null;
};

type ActionState = {
  kind: "assign" | "redispatch";
  orderId: string;
};

const ASSIGNABLE_STATUSES = new Set(["REQUESTED", "ASSIGNED", "HERO_ACCEPTED"]);

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);
const pickLabel = (locale: "ar" | "en", ar?: string | null, en?: string | null) =>
  locale === "ar" ? ar || en || "--" : en || ar || "--";

const assignmentReasonLabel = (locale: "ar" | "en", reason: "DEDICATED_BRANCH" | "NEAREST_IN_ZONE") =>
  reason === "DEDICATED_BRANCH"
    ? tx(locale, "مخصص لهذا الفرع", "Dedicated branch")
    : tx(locale, "الأقرب داخل النطاق", "Nearest in zone");

const distanceLabel = (locale: "ar" | "en", value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)} ${tx(locale, "كم", "km")}` : tx(locale, "بانتظار الموقع الحي", "Awaiting live location");

export default function AdminOrdersPage() {
  const { locale, direction } = useLocale();
  const [orders, setOrders] = React.useState<AdminOrder[]>([]);
  const [branches, setBranches] = React.useState<BranchRecord[]>([]);
  const [zones, setZones] = React.useState<ZoneRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [merchantFilter, setMerchantFilter] = React.useState("");
  const [branchFilter, setBranchFilter] = React.useState("");
  const [zoneFilter, setZoneFilter] = React.useState("");
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "gold"; message: string } | null>(null);
  const [selectionByOrder, setSelectionByOrder] = React.useState<Record<string, string>>({});
  const [actionState, setActionState] = React.useState<ActionState | null>(null);
  const { lastMessage } = useSocket(["orders"]);

  const loadFilters = React.useCallback(async () => {
    const [branchData, zoneData] = await Promise.all([
      apiFetch<BranchRecord[]>("/v1/admin/branches?status=ACTIVE", undefined, "ADMIN"),
      apiFetch<ZoneRecord[]>("/v1/admin/zones", undefined, "ADMIN"),
    ]);
    setBranches(branchData);
    setZones(zoneData);
  }, []);

  const loadData = React.useCallback(
    async (showLoading: boolean) => {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const params = new URLSearchParams();
        const normalizedQuery = query.trim();
        if (normalizedQuery) {
          params.set("q", normalizedQuery);
        }
        if (merchantFilter) {
          params.set("merchantId", merchantFilter);
        }
        if (branchFilter) {
          params.set("branchId", branchFilter);
        }
        if (zoneFilter) {
          params.set("zoneId", zoneFilter);
        }

        const path = params.size ? `/v1/admin/orders?${params.toString()}` : "/v1/admin/orders";
        const ordersData = await apiFetch<AdminOrder[]>(path, undefined, "ADMIN");
        setOrders(ordersData);
        setSelectionByOrder((current) => {
          const next = { ...current };
          for (const order of ordersData) {
            next[order.id] = current[order.id] || order.hero?.id || "";
          }
          return next;
        });
      } finally {
        if (showLoading) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [branchFilter, merchantFilter, query, zoneFilter],
  );

  React.useEffect(() => {
    Promise.all([loadData(true), loadFilters()]).catch((error: unknown) => {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر تحميل لوحة الإسناد.", "Could not load the dispatch board."),
      });
    });
  }, [loadData, loadFilters, locale]);

  React.useEffect(() => {
    if (!lastMessage) {
      return;
    }

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

  const merchantOptions = React.useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    for (const branch of branches) {
      if (!seen.has(branch.merchant.id)) {
        seen.set(branch.merchant.id, {
          value: branch.merchant.id,
          label: pickLabel(locale, branch.merchant.nameAr, branch.merchant.name),
        });
      }
    }
    return Array.from(seen.values()).sort((left, right) => left.label.localeCompare(right.label, locale));
  }, [branches, locale]);

  const branchOptions = React.useMemo(() => {
    return branches
      .filter((branch) => !merchantFilter || branch.merchant.id === merchantFilter)
      .map((branch) => ({
        value: branch.id,
        label: `${pickLabel(locale, branch.nameAr, branch.name)} • ${pickLabel(locale, branch.merchant.nameAr, branch.merchant.name)}`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, locale));
  }, [branches, locale, merchantFilter]);

  const zoneOptions = React.useMemo(
    () =>
      zones
        .map((zone) => ({
          value: zone.id,
          label: pickLabel(locale, zone.nameAr, zone.name),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale)),
    [locale, zones],
  );

  React.useEffect(() => {
    if (branchFilter && !branchOptions.some((branch) => branch.value === branchFilter)) {
      setBranchFilter("");
    }
  }, [branchFilter, branchOptions]);

  const chips = React.useMemo(
    () => [
      { label: { ar: `${orders.length} طلب`, en: `${orders.length} orders` }, tone: "neutral" as const },
      {
        label: { ar: `${orders.filter((order) => !order.heroId).length} بدون إسناد`, en: `${orders.filter((order) => !order.heroId).length} unassigned` },
        tone: "gold" as const,
      },
      {
        label: { ar: `${orders.filter((order) => order.status === "DELIVERED").length} تم`, en: `${orders.filter((order) => order.status === "DELIVERED").length} delivered` },
        tone: "success" as const,
      },
      ...(refreshing ? [{ label: { ar: "جار التحديث", en: "Refreshing" }, tone: "neutral" as const }] : []),
    ],
    [orders, refreshing],
  );

  async function handleAssign(order: AdminOrder) {
    const heroId = selectionByOrder[order.id];
    if (!heroId) {
      setFeedback({
        tone: "gold",
        message: tx(locale, "اختر طيارًا أولًا.", "Select a hero first."),
      });
      return;
    }

    setActionState({ kind: "assign", orderId: order.id });
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/orders/${order.id}/assignment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ heroId }),
        },
        "ADMIN",
      );
      await loadData(false);
      setFeedback({
        tone: "success",
        message: tx(locale, "تم تحديث الإسناد.", "Assignment updated."),
      });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر تحديث الإسناد.", "Could not update assignment."),
      });
    } finally {
      setActionState(null);
    }
  }

  async function handleRedispatch(order: AdminOrder) {
    setActionState({ kind: "redispatch", orderId: order.id });
    setFeedback(null);
    try {
      await apiFetch(
        `/v1/admin/orders/${order.id}/dispatch/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        "ADMIN",
      );
      await loadData(false);
      setFeedback({
        tone: "success",
        message: tx(locale, "تمت إعادة الطلب إلى غرفة الإسناد.", "Order sent back to dispatch."),
      });
    } catch (error) {
      setFeedback({
        tone: "gold",
        message: error instanceof Error ? error.message : tx(locale, "تعذر إعادة الإسناد.", "Could not re-dispatch the order."),
      });
    } finally {
      setActionState(null);
    }
  }

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير النظام", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "الطلبات", en: "Orders" }}
      pageSubtitle={{ ar: "المراقبة والإسناد من شاشة واحدة.", en: "Monitor and dispatch from one screen." }}
    >
      <div className="space-y-6 md:space-y-8">
        <PageHeader
          eyebrow={{ ar: "غرفة الطلبات", en: "Order room" }}
          title={{ ar: "الإسناد والمتابعة", en: "Dispatch and follow-up" }}
          subtitle={{
            ar: "راجع الحالة وغيّر الطيار أو أعد الطلب إلى الإسناد عند الحاجة.",
            en: "Review status, reassign heroes, or send the order back to dispatch when needed.",
          }}
          breadcrumbs={[
            { label: { ar: "الإدارة", en: "Admin" }, href: "/admin" },
            { label: { ar: "الطلبات", en: "Orders" } },
          ]}
          chips={chips}
        />

        <Card className="space-y-5">
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <h2 className="app-font-heading text-xl text-text-primary">{tx(locale, "لوحة الإسناد", "Dispatch board")}</h2>
              <p className="app-font-body text-sm text-text-secondary">
                {tx(
                  locale,
                  "ابحث في الطلبات وصفِّها حسب التاجر والفرع والمنطقة، ثم عدل الإسناد من نفس البطاقة.",
                  "Search orders, filter by merchant, branch, and zone, then manage assignment from the same card.",
                )}
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tx(locale, "ابحث برقم الطلب أو العميل أو الفرع", "Search by order, customer, or branch")}
              />
              <Select
                value={merchantFilter}
                onChange={(event) => setMerchantFilter(event.target.value)}
                options={[
                  { value: "", label: tx(locale, "كل التجار", "All merchants") },
                  ...merchantOptions,
                ]}
                dir={direction}
              />
              <Select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                options={[
                  { value: "", label: tx(locale, "كل الفروع", "All branches") },
                  ...branchOptions,
                ]}
                dir={direction}
              />
              <Select
                value={zoneFilter}
                onChange={(event) => setZoneFilter(event.target.value)}
                options={[
                  { value: "", label: tx(locale, "كل المناطق", "All zones") },
                  ...zoneOptions,
                ]}
                dir={direction}
              />
              <Button variant="secondary" onClick={() => void loadData(false)} loading={loading || refreshing}>
                {tx(locale, "تحديث", "Refresh")}
              </Button>
            </div>
          </div>

          {feedback ? (
            <div
              className={`rounded-[20px] border px-4 py-3 text-sm ${
                feedback.tone === "success"
                  ? "border-[var(--success-400)] bg-[var(--success-50)] text-[var(--success-700)] dark:border-[var(--success-600)] dark:bg-[var(--success-900)] dark:text-[var(--success-100)]"
                  : "border-[var(--gold-400)] bg-[var(--gold-50)] text-[var(--gold-700)] dark:border-[var(--gold-600)] dark:bg-[var(--gold-900)] dark:text-[var(--gold-100)]"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="grid gap-4 lg:hidden">
            {orders.map((order) => {
              const busy = actionState?.orderId === order.id;
              const assignable = ASSIGNABLE_STATUSES.has(order.status);

              return (
                <Card key={order.id} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-black text-[var(--text-primary)]">{order.orderNumber}</div>
                      <div className="mt-1 text-xs text-[var(--text-tertiary)]">{formatLocalizedDateTime(order.requestedAt, locale)}</div>
                    </div>
                    <StatusPill label={orderStatusText(order.status)} tone={orderStatusTone(order.status)} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                      <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "التاجر / الفرع", "Merchant / branch")}</div>
                      <div className="mt-1 font-bold text-[var(--text-primary)]">{order.branch.brandName}</div>
                      <div className="text-sm text-[var(--text-secondary)]">{pickLabel(locale, order.branch.nameAr, order.branch.name)}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                      <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "العميل", "Customer")}</div>
                      <div className="mt-1 font-bold text-[var(--text-primary)]">
                        {order.customerName || tx(locale, "عميل بدون اسم", "Unnamed customer")}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]" dir="ltr">
                        {order.customerPhone}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                      <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "المنطقة", "Zone")}</div>
                      <div className="mt-1 text-[var(--text-primary)]">{pickLabel(locale, order.zone.nameAr, order.zone.name)}</div>
                    </div>
                    <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3">
                      <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الرسوم", "Fee")}</div>
                      <div className="mt-1 font-mono text-[var(--text-primary)]">{formatLocalizedCurrency(order.deliveryFee || 0, locale)}</div>
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                    <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "العنوان", "Address")}</div>
                    <div className="mt-1">{order.deliveryAddress || tx(locale, "بدون عنوان", "No address")}</div>
                  </div>

                  <div className="space-y-3 rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)]">{tx(locale, "الطيار الحالي", "Current hero")}</div>
                      <div className="mt-1 font-bold text-[var(--text-primary)]">
                        {order.hero?.name || tx(locale, "بدون إسناد", "Unassigned")}
                      </div>
                    </div>

                    <div className="text-xs text-[var(--text-tertiary)]">
                      {order.eligibleHeroes.length
                        ? tx(locale, "القائمة مرتبة حسب التخصيص للفرع ثم الأقرب داخل نطاق الفرع والمنطقة.", "List is ranked by branch dedication first, then nearest inside the order branch and zone.")
                        : tx(locale, "لا يوجد طيارون مؤهلون الآن. تأكد من تفعيل الطيار وتوثيقه وربطه بفرع ومنطقة مناسبة.", "No eligible heroes right now. Make sure the hero is active, approved, and linked to the right branch and zone.")}
                    </div>

                    <Select
                      value={selectionByOrder[order.id] || ""}
                      onChange={(event) =>
                        setSelectionByOrder((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      disabled={!assignable || busy}
                      options={[
                        { value: "", label: tx(locale, "اختر طيارًا", "Select hero") },
                        ...order.eligibleHeroes.map((hero) => ({
                          value: hero.id,
                          label: `${hero.name} - ${assignmentReasonLabel(locale, hero.assignmentReason)} - ${distanceLabel(locale, hero.distanceKm)}`,
                        })),
                      ]}
                      dir={direction}
                    />

                    {selectionByOrder[order.id] ? (
                      (() => {
                        const selectedHero = order.eligibleHeroes.find((hero) => hero.id === selectionByOrder[order.id]);
                        if (!selectedHero) {
                          return null;
                        }

                        return (
                          <div className="rounded-[18px] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-4 py-3 text-xs text-[var(--text-secondary)]">
                            <div className="font-bold text-[var(--text-primary)]">{selectedHero.name}</div>
                            <div className="mt-1">{assignmentReasonLabel(locale, selectedHero.assignmentReason)}</div>
                            <div className="mt-1">
                              {tx(locale, "المسافة", "Distance")}: {distanceLabel(locale, selectedHero.distanceKm)} - {tx(locale, "الطلبات النشطة", "Active orders")}: {selectedHero.activeOrders}
                            </div>
                          </div>
                        );
                      })()
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={busy && actionState?.kind === "assign"}
                        disabled={!assignable || !selectionByOrder[order.id]}
                        onClick={() => void handleAssign(order)}
                      >
                        {order.heroId ? tx(locale, "تغيير الطيار", "Change hero") : tx(locale, "إسناد الآن", "Assign now")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={busy && actionState?.kind === "redispatch"}
                        disabled={!assignable}
                        onClick={() => void handleRedispatch(order)}
                      >
                        {tx(locale, "إعادة للإسناد", "Re-dispatch")}
                      </Button>
                    </div>

                    <Link
                      href={`/admin/branches/${order.branch.id}`}
                      className="app-font-body text-xs font-bold text-[var(--primary-700)] underline decoration-[var(--border-default)] underline-offset-4"
                    >
                      {tx(locale, "فتح الفرع", "Open branch")}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1220px] text-sm">
              <thead className="border-b border-[var(--border-default)] text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "رقم الطلب", "Order number")}</th>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "التاجر / الفرع", "Merchant / branch")}</th>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "العميل", "Customer")}</th>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "المنطقة", "Zone")}</th>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "الطيار الحالي", "Current hero")}</th>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "الحالة", "Status")}</th>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "الرسوم", "Fee")}</th>
                  <th className="px-4 py-3 text-start font-bold">{tx(locale, "الإسناد", "Dispatch")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {orders.map((order) => {
                  const busy = actionState?.orderId === order.id;
                  const assignable = ASSIGNABLE_STATUSES.has(order.status);

                  return (
                    <tr key={order.id} className="align-top transition-colors hover:bg-[var(--bg-surface-2)]">
                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-[var(--text-primary)]">{order.orderNumber}</div>
                        <div className="mt-1 text-xs text-[var(--text-tertiary)]">{formatLocalizedDateTime(order.requestedAt, locale)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--text-primary)]">{order.branch.brandName}</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">{pickLabel(locale, order.branch.nameAr, order.branch.name)}</div>
                        <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                          <Link href={`/admin/branches/${order.branch.id}`} className="underline decoration-[var(--border-default)] underline-offset-4">
                            {tx(locale, "فتح الفرع", "Open branch")}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--text-primary)]">
                          {order.customerName || tx(locale, "عميل بدون اسم", "Unnamed customer")}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]" dir="ltr">
                          {order.customerPhone}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-tertiary)]">{order.deliveryAddress || tx(locale, "بدون عنوان", "No address")}</div>
                      </td>
                      <td className="px-4 py-4 text-[var(--text-secondary)]">{pickLabel(locale, order.zone.nameAr, order.zone.name)}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--text-primary)]">{order.hero?.name || tx(locale, "بدون إسناد", "Unassigned")}</div>
                        <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {assignable ? tx(locale, "متاح للتعديل الآن", "Can be changed now") : tx(locale, "داخل التنفيذ", "Already in fulfillment")}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill label={orderStatusText(order.status)} tone={orderStatusTone(order.status)} />
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-[var(--text-primary)] opacity-80">{formatLocalizedCurrency(order.deliveryFee || 0, locale)}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-3 rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                          <Select
                            value={selectionByOrder[order.id] || ""}
                            onChange={(event) =>
                              setSelectionByOrder((current) => ({
                                ...current,
                                [order.id]: event.target.value,
                              }))
                            }
                            disabled={!assignable || busy}
                            options={[
                              { value: "", label: tx(locale, "اختر طيارًا", "Select hero") },
                              ...order.eligibleHeroes.map((hero) => ({
                                value: hero.id,
                                label: `${hero.name} - ${assignmentReasonLabel(locale, hero.assignmentReason)} - ${distanceLabel(locale, hero.distanceKm)}`,
                              })),
                            ]}
                            dir={direction}
                          />

                          <div className="text-xs text-[var(--text-tertiary)]">
                            {order.eligibleHeroes.length
                              ? tx(locale, "تظهر هنا فقط الأسماء المؤهلة داخل نفس الفرع والمنطقة.", "Only eligible heroes from the same branch and zone appear here.")
                              : tx(locale, "لا يوجد طيارون مؤهلون الآن. راجع التفعيل والتوثيق وربط الفرع والمنطقة.", "No eligible heroes right now. Check activation, approval, and branch/zone linkage.")}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              loading={busy && actionState?.kind === "assign"}
                              disabled={!assignable || !selectionByOrder[order.id]}
                              onClick={() => void handleAssign(order)}
                            >
                              {order.heroId ? tx(locale, "تغيير الطيار", "Change hero") : tx(locale, "إسناد الآن", "Assign now")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              loading={busy && actionState?.kind === "redispatch"}
                              disabled={!assignable}
                              onClick={() => void handleRedispatch(order)}
                            >
                              {tx(locale, "إعادة للإسناد", "Re-dispatch")}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!orders.length ? (
            <div className="rounded-[22px] border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] px-6 py-10 text-center">
              <p className="app-font-heading text-lg text-[var(--text-primary)]">{tx(locale, "لا توجد طلبات مطابقة", "No matching orders")}</p>
              <p className="app-font-body mt-2 text-sm text-[var(--text-secondary)]">
                {tx(locale, "جرّب تغيير التاجر أو الفرع أو المنطقة أو ابحث برقم الطلب.", "Try another merchant, branch, zone, or search term.")}
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </PageShell>
  );
}
