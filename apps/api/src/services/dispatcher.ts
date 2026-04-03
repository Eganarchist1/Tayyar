import { Prisma } from "@tayyar/db";
import { prisma } from "../lib/prisma";
import { raiseOperationalAlert, resolveOperationalAlert } from "./operational-alerts";

const ACTIVE_ORDER_STATUSES = ["ASSIGNED", "HERO_ACCEPTED", "PICKED_UP", "ON_WAY", "IN_TRANSIT", "ARRIVED"] as const;
const MAX_ACTIVE_ORDERS_PER_HERO = 2;

/**
 * Tayyar Smart Dispatcher
 * Responsibility: Find the best Hero for an order based on:
 * 1. Proximity (Haversine distance for now)
 * 2. Workload (Orders today to ensure fairness)
 * 3. Availability (Status is ONLINE and not over-batched)
 */
export class DispatcherService {
  /**
   * Assign a hero to a newly created order
   */
  static async autoAssign(orderId: string, logger?: { info?: (payload: unknown, message?: string) => void; warn?: (payload: unknown, message?: string) => void; error?: (payload: unknown, message?: string) => void }) {
    const now = new Date();
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { zone: true, branch: true },
    });

    if (!order) return;

    const branchDedicatedAssignments = await prisma.heroAssignment.findMany({
      where: {
        branchId: order.branchId,
        isActive: true,
        model: "DEDICATED",
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        hero: {
          include: { user: true },
        },
      },
    });

    const dedicatedHeroIds = branchDedicatedAssignments.map((assignment) => assignment.heroId);

    const candidates = await prisma.heroProfile.findMany({
      where: {
        status: "ONLINE",
        isVerified: true,
        currentLat: { not: null },
        currentLng: { not: null },
        OR: [
          { id: { in: dedicatedHeroIds.length ? dedicatedHeroIds : ["__no_match__"] } },
          {
            zoneId: order.zoneId,
            assignments: {
              none: {
                isActive: true,
                model: "DEDICATED",
                startDate: { lte: now },
                OR: [{ endDate: null }, { endDate: { gte: now } }],
              },
            },
          },
        ],
      },
      include: { user: true },
    });

    if (candidates.length === 0) {
      await raiseOperationalAlert({
        dedupeKey: `unassigned-order:${orderId}`,
        kind: "UNASSIGNED_ORDER",
        severity: "medium",
        titleCode: "orders.unassigned.title",
        messageCode: "orders.unassigned.message",
        entityType: "ORDER",
        entityId: orderId,
        actionHref: "/admin/orders",
        metadata: {
          orderId,
          orderNumber: order.orderNumber,
          zoneId: order.zoneId,
          requestedAt: order.requestedAt.toISOString(),
        },
      });
      logger?.warn?.(
        {
          orderId,
          zoneId: order.zoneId,
          reason: "no_online_verified_heroes",
        },
        "No available heroes for auto-assignment",
      );
      return null;
    }

    const workloadByHero = await prisma.order.groupBy({
      by: ["heroId"],
      where: {
        heroId: { in: candidates.map((hero) => hero.id) },
        status: { in: ACTIVE_ORDER_STATUSES as unknown as Array<any> },
      },
      _count: { heroId: true },
    });
    const workloadMap = new Map(
      workloadByHero.map((row) => [row.heroId || "", row._count.heroId]),
    );

    const scoredCandidates = candidates.map((hero) => {
      const activeOrders = workloadMap.get(hero.id) || 0;
      const pickupDistance = this.calculateDistance(order.pickupLat, order.pickupLng, hero.currentLat!, hero.currentLng!);
      const workloadScore = activeOrders * 3 + hero.ordersToday * 1.5;
      const dedicatedBoost = dedicatedHeroIds.includes(hero.id) ? -25 : 0;

      return {
        hero,
        activeOrders,
        totalScore: pickupDistance + workloadScore + dedicatedBoost,
      };
    });

    const rankedCandidates = scoredCandidates
      .filter((candidate) => candidate.activeOrders < MAX_ACTIVE_ORDERS_PER_HERO)
      .sort((left, right) => left.totalScore - right.totalScore);

    for (const candidate of rankedCandidates) {
      const assignment = await prisma.$transaction(
        async (tx) => {
          const freshOrder = await tx.order.findUnique({
            where: { id: orderId },
          });

          if (!freshOrder || freshOrder.heroId || freshOrder.status !== "REQUESTED") {
            return null;
          }

          const freshHero = await tx.heroProfile.findUnique({
            where: { id: candidate.hero.id },
          });

          if (
            !freshHero ||
            freshHero.status !== "ONLINE" ||
            freshHero.currentLat === null ||
            freshHero.currentLng === null ||
            !freshHero.isVerified
          ) {
            return null;
          }

          const activeOrders = await tx.order.count({
            where: {
              heroId: candidate.hero.id,
              status: { in: ACTIVE_ORDER_STATUSES as unknown as Array<any> },
            },
          });

          if (activeOrders >= MAX_ACTIVE_ORDERS_PER_HERO) {
            return null;
          }

          const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
              heroId: candidate.hero.id,
              status: "ASSIGNED",
              assignedAt: new Date(),
              statusHistory: {
                create: {
                  status: "ASSIGNED",
                  changedBy: candidate.hero.userId,
                  note: "Auto-dispatch assigned hero based on pickup proximity and workload.",
                  lat: freshHero.currentLat,
                  lng: freshHero.currentLng,
                },
              },
            },
          });

          await tx.heroProfile.update({
            where: { id: candidate.hero.id },
            data: {
              status: "ON_DELIVERY",
              ordersToday: { increment: 1 },
              lastOrderAt: new Date(),
            },
          });

          return updatedOrder;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (assignment) {
        await resolveOperationalAlert(`unassigned-order:${orderId}`);
        logger?.info?.(
          {
            orderId,
            heroId: candidate.hero.id,
            score: candidate.totalScore,
            activeOrders: candidate.activeOrders,
          },
          "Order auto-assigned",
        );
        return assignment;
      }
    }

    await raiseOperationalAlert({
      dedupeKey: `unassigned-order:${orderId}`,
      kind: "UNASSIGNED_ORDER",
      severity: "medium",
      titleCode: "orders.unassigned.title",
      messageCode: "orders.unassigned.message",
      entityType: "ORDER",
      entityId: orderId,
      actionHref: "/admin/orders",
      metadata: {
        orderId,
        orderNumber: order.orderNumber,
        zoneId: order.zoneId,
        requestedAt: order.requestedAt.toISOString(),
      },
    });
    logger?.warn?.(
      {
        orderId,
        zoneId: order.zoneId,
        reason: "all_candidates_exhausted",
      },
      "Order remains unassigned after auto-dispatch pass",
    );
    return null;
  }

  /**
   * Helper: Haversine Distance (Air distance in km)
   * Future: Move to OSRM/Google Maps for road distance
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}
