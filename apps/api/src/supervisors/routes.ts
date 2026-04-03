import { FastifyInstance } from "fastify";
import { requireRole } from "../decorators/auth";
import { prisma } from "../lib/prisma";
import { getSupervisorOperationalAlerts } from "../services/operational-alerts";
import { AppError } from "../lib/errors";
import { parseObjectBody } from "../lib/request-body";
import { recordAuditEvent } from "../services/audit-events";
import { assertHeroEligibleForOrder, listEligibleHeroesForOrder } from "../services/assignment-eligibility";

export default async function supervisorRoutes(server: FastifyInstance) {
  server.addHook("onRequest", requireRole(["SUPERVISOR", "ADMIN"]));

  // Helper to get zones for the current supervisor
  const getSupervisorZones = async (request: any) => {
    const userEmail = (request.user as any).email;
    const supervisor = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { supervisorZones: true }
    });

    if (supervisor?.supervisorZones?.length) {
      return supervisor.supervisorZones.map((sz: any) => sz.zoneId);
    }

    // Development fallback so the supervisor surface stays usable before seed data exists.
    if (process.env.NODE_ENV !== "production") {
      const zones = await prisma.zone.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      return zones.map((zone) => zone.id);
    }

    return [];
  };

  server.get("/map/live", async (request, reply) => {
    const zoneIds = await getSupervisorZones(request);
    
    // Get live hero locations in assigned zones
    const [heroes, zones] = await Promise.all([
      prisma.heroProfile.findMany({
        where: { zoneId: { in: zoneIds } },
        include: { user: true, zone: true }
      }),
      prisma.zone.findMany({
        where: { id: { in: zoneIds } },
        select: {
          id: true,
          name: true,
          nameAr: true,
          boundaryWkt: true,
        },
      }),
    ]);

    return { heroes, zones };
  });

  server.get("/orders/active", async (request, reply) => {
    const zoneIds = await getSupervisorZones(request);
    
    const orders = await prisma.order.findMany({
      where: {
        zoneId: { in: zoneIds },
        status: { notIn: ["DELIVERED", "FAILED", "CANCELLED"] }
      },
      include: {
        branch: true,
        hero: { include: { user: true } }
      }
    });

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const { eligibleHeroes } = await listEligibleHeroesForOrder(order.id, zoneIds);
        return {
          ...order,
          branch: {
            ...order.branch,
          },
          deliveryLat: order.deliveryLat,
          deliveryLng: order.deliveryLng,
          eligibleHeroes,
        };
      }),
    );

    return enrichedOrders;
  });

  server.get("/heroes", async (request) => {
    const zoneIds = await getSupervisorZones(request);
    const heroes = await prisma.heroProfile.findMany({
      where: {
        zoneId: { in: zoneIds },
        user: {
          is: {
            isActive: true,
          },
        },
      },
      include: {
        user: true,
        zone: true,
        assignments: {
          where: { isActive: true },
          include: {
            branch: {
              include: {
                brand: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    return heroes.map((hero) => ({
      id: hero.id,
      userId: hero.userId,
      status: hero.status,
      isVerified: hero.isVerified,
      verificationStatus: hero.verificationStatus,
      currentLat: hero.currentLat,
      currentLng: hero.currentLng,
      totalDeliveries: hero.totalDeliveries,
      user: {
        name: hero.user.name,
        phone: hero.user.phone,
        email: hero.user.email,
      },
      zone: hero.zone
        ? {
            id: hero.zone.id,
            name: hero.zone.name,
            nameAr: hero.zone.nameAr,
          }
        : null,
      assignments: hero.assignments.map((assignment) => ({
        id: assignment.id,
        model: assignment.model,
        branch: {
          id: assignment.branch.id,
          name: assignment.branch.name,
          nameAr: assignment.branch.nameAr,
          merchantName: assignment.branch.brand.name,
          merchantNameAr: assignment.branch.brand.nameAr,
        },
      })),
    }));
  });

  server.get("/alerts", async (request, reply) => {
    const zoneIds = await getSupervisorZones(request);
    return getSupervisorOperationalAlerts(zoneIds);
  });

  server.patch("/orders/:id/reassign", async (request, reply) => {
    const { id } = request.params as any;
    const { heroId } = parseObjectBody<{ heroId?: string }>(request.body);
    const actor = request.user as { id?: string; email?: string };
    const zoneIds = await getSupervisorZones(request);

    if (!heroId) {
      throw new AppError(400, "HERO_REQUIRED", "heroId is required");
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        zoneId: { in: zoneIds },
        status: { notIn: ["DELIVERED", "FAILED", "CANCELLED"] },
      },
      include: {
        hero: {
          include: { user: true },
        },
      },
    });

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found in supervisor scope");
    }

    const eligibility = await assertHeroEligibleForOrder(id, heroId, zoneIds);
    if (!eligibility.hero) {
      throw new AppError(409, "HERO_NOT_ELIGIBLE", "Hero is not eligible for this order");
    }
    const eligibleHero = eligibility.hero;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id },
        data: {
          heroId,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
        include: {
          branch: true,
          hero: {
            include: { user: true },
          },
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: "ASSIGNED",
          changedBy: actor.id || null,
          note: `Supervisor reassigned order to ${eligibleHero.name} (${eligibleHero.assignmentReason})`,
        },
      });

      await tx.operationalNote.create({
        data: {
          entityType: "ORDER",
          entityId: id,
          orderId: id,
          authorId: actor.id || null,
          note: `Supervisor reassigned order to ${eligibleHero.name} (${eligibleHero.assignmentReason})`,
        },
      });

      return nextOrder;
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "ORDER_REASSIGNED",
      entityType: "ORDER",
      entityId: id,
      summary: {
        previousHeroId: order.heroId,
        nextHeroId: eligibleHero.heroId,
        assignmentReason: eligibleHero.assignmentReason,
      },
      before: {
        heroId: order.heroId,
        heroName: order.hero?.user.name || null,
        status: order.status,
      },
      after: {
        heroId: updatedOrder.heroId,
        heroName: updatedOrder.hero?.user.name || null,
        status: updatedOrder.status,
      },
    });

    return updatedOrder;
  });

  server.get("/heroes/:heroId/replay", async (request, reply) => {
    const { heroId } = request.params as any;
    
    return prisma.breadcrumb.findMany({
      where: { heroId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  });
}
