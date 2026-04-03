import { Prisma } from "@prisma/client";
import { OrderStatus } from "@tayyar/db";
import { prisma } from "../lib/prisma";

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "REQUESTED",
  "ASSIGNED",
  "HERO_ACCEPTED",
  "PICKED_UP",
  "ON_WAY",
  "IN_TRANSIT",
  "ARRIVED",
];

type RaiseAlertInput = {
  dedupeKey: string;
  kind: string;
  severity: "low" | "medium" | "high";
  titleCode: string;
  messageCode: string;
  entityType?: string | null;
  entityId?: string | null;
  actionHref?: string | null;
  metadata?: Record<string, unknown> | null;
};

function toJsonValue(value?: Record<string, unknown> | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export async function raiseOperationalAlert(input: RaiseAlertInput) {
  return prisma.operationalAlert.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {
      kind: input.kind,
      severity: input.severity,
      status: "OPEN",
      titleCode: input.titleCode,
      messageCode: input.messageCode,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      actionHref: input.actionHref || null,
      metadata: toJsonValue(input.metadata),
      resolvedAt: null,
    },
    create: {
      dedupeKey: input.dedupeKey,
      kind: input.kind,
      severity: input.severity,
      status: "OPEN",
      titleCode: input.titleCode,
      messageCode: input.messageCode,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      actionHref: input.actionHref || null,
      metadata: toJsonValue(input.metadata),
    },
  });
}

export async function resolveOperationalAlert(dedupeKey: string) {
  return prisma.operationalAlert.updateMany({
    where: {
      dedupeKey,
      status: "OPEN",
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });
}

function viewAlert(alert: {
  id: string;
  kind: string;
  severity: string;
  status: string;
  titleCode: string;
  messageCode: string;
  entityType: string | null;
  entityId: string | null;
  actionHref: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}) {
  return {
    id: alert.id,
    kind: alert.kind,
    severity: alert.severity,
    status: alert.status,
    titleCode: alert.titleCode,
    messageCode: alert.messageCode,
    entityType: alert.entityType,
    entityId: alert.entityId,
    actionHref: alert.actionHref,
    metadata: alert.metadata,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() || null,
  };
}

async function syncBillingFailureAlerts() {
  const failedTransactions = await prisma.transaction.findMany({
    where: { status: "FAILED" },
    include: {
      merchant: true,
      hero: { include: { user: true } },
      order: true,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  await Promise.all(
    failedTransactions.map((transaction) =>
      raiseOperationalAlert({
        dedupeKey: `billing-failure:${transaction.id}`,
        kind: "BILLING_FAILURE",
        severity: "high",
        titleCode: "billing.failure.title",
        messageCode: "billing.failure.message",
        entityType: transaction.orderId ? "ORDER" : transaction.merchantId ? "MERCHANT" : "TRANSACTION",
        entityId: transaction.orderId || transaction.merchantId || transaction.id,
        actionHref: transaction.orderId ? "/admin/orders" : transaction.merchantId ? `/admin/merchants/${transaction.merchantId}` : "/admin/finance",
        metadata: {
          transactionId: transaction.id,
          merchantId: transaction.merchantId,
          merchantName: transaction.merchant?.nameAr || transaction.merchant?.name || null,
          heroId: transaction.heroId,
          heroName: transaction.hero?.user.name || null,
          orderId: transaction.orderId,
          orderNumber: transaction.order?.orderNumber || null,
          amount: transaction.amount,
          currency: transaction.currency,
        },
      }),
    ),
  );
}

async function syncUnassignedOrderAlerts() {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      status: "REQUESTED",
      heroId: null,
      requestedAt: { lte: staleBefore },
    },
    include: {
      branch: {
        include: {
          brand: true,
        },
      },
      zone: true,
    },
    orderBy: { requestedAt: "asc" },
    take: 16,
  });

  const openOrderIds = new Set(orders.map((order) => order.id));

  const existing = await prisma.operationalAlert.findMany({
    where: {
      kind: "UNASSIGNED_ORDER",
      status: "OPEN",
    },
    select: {
      dedupeKey: true,
      entityId: true,
    },
  });

  await Promise.all(
    existing
      .filter((alert) => alert.entityId && !openOrderIds.has(alert.entityId))
      .map((alert) => resolveOperationalAlert(alert.dedupeKey || `unassigned-order:${alert.entityId}`)),
  );

  await Promise.all(
    orders.map((order) =>
      raiseOperationalAlert({
        dedupeKey: `unassigned-order:${order.id}`,
        kind: "UNASSIGNED_ORDER",
        severity: "medium",
        titleCode: "orders.unassigned.title",
        messageCode: "orders.unassigned.message",
        entityType: "ORDER",
        entityId: order.id,
        actionHref: "/admin/orders",
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          zoneId: order.zone.id,
          zoneName: order.zone.nameAr || order.zone.name,
          branchId: order.branch.id,
          branchName: order.branch.nameAr || order.branch.name,
          merchantId: order.branch.brandId,
          merchantName: order.branch.brand.nameAr || order.branch.brand.name,
          requestedAt: order.requestedAt.toISOString(),
        },
      }),
    ),
  );
}

async function syncStaleBranchCoordinateAlerts() {
  const branches = await prisma.branch.findMany({
    include: {
      brand: true,
    },
  });

  await Promise.all(
    branches.map((branch) => {
      const isDefault = branch.lat === 30.0444 && branch.lng === 31.2357;
      if (!isDefault) {
        return resolveOperationalAlert(`stale-branch-coordinates:${branch.id}`);
      }

      return raiseOperationalAlert({
        dedupeKey: `stale-branch-coordinates:${branch.id}`,
        kind: "STALE_BRANCH_COORDINATES",
        severity: "medium",
        titleCode: "branches.coordinates.title",
        messageCode: "branches.coordinates.message",
        entityType: "BRANCH",
        entityId: branch.id,
        actionHref: `/admin/branches/${branch.id}`,
        metadata: {
          branchId: branch.id,
          branchName: branch.nameAr || branch.name,
          merchantId: branch.brandId,
          merchantName: branch.brand.nameAr || branch.brand.name,
        },
      });
    }),
  );
}

export async function getAdminOperationalAlerts() {
  await Promise.all([
    syncBillingFailureAlerts(),
    syncUnassignedOrderAlerts(),
    syncStaleBranchCoordinateAlerts(),
  ]);

  const alerts = await prisma.operationalAlert.findMany({
    where: {
      status: "OPEN",
    },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    take: 18,
  });

  return alerts.map(viewAlert);
}

export async function getSupervisorOperationalAlerts(zoneIds: string[]) {
  await syncUnassignedOrderAlerts();

  const alerts = await prisma.operationalAlert.findMany({
    where: {
      status: "OPEN",
      kind: {
        in: ["UNASSIGNED_ORDER", "LIVE_FEED_DEGRADED"],
      },
    },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    take: 24,
  });

  return alerts
    .filter((alert) => {
      const metadata = (alert.metadata || {}) as Record<string, unknown>;
      const zoneId = typeof metadata.zoneId === "string" ? metadata.zoneId : null;
      return !zoneId || zoneIds.includes(zoneId);
    })
    .map(viewAlert);
}
