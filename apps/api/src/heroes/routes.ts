import { FastifyInstance } from "fastify";
import { VacationType } from "@tayyar/db";
import { requireRole } from "../decorators/auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import {
  buildHeroCompensationSummary,
  createHeroVacationRequest,
  getHeroHrDetailsByUserId,
} from "../services/staff-operations";

const heroOrderTransitions: Record<string, string[]> = {
  ASSIGNED: ["HERO_ACCEPTED", "PICKED_UP", "FAILED"],
  HERO_ACCEPTED: ["PICKED_UP", "FAILED"],
  PICKED_UP: ["ON_WAY", "IN_TRANSIT", "ARRIVED", "FAILED"],
  ON_WAY: ["IN_TRANSIT", "ARRIVED", "FAILED"],
  IN_TRANSIT: ["ARRIVED", "FAILED"],
  ARRIVED: ["FAILED"],
};

function assertHeroOrderTransition(currentStatus: string, nextStatus: string) {
  const allowed = heroOrderTransitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(409, "INVALID_ORDER_TRANSITION", `Cannot transition order from ${currentStatus} to ${nextStatus}`);
  }
}

export default async function heroRoutes(server: FastifyInstance) {
  server.addHook("onRequest", requireRole(["HERO", "ADMIN"]));

  const getCurrentHero = async (request: any) => {
    const userEmail = request.user?.email;
    return prisma.heroProfile.findFirst({
      where: {
        user: {
          email: userEmail,
        },
      },
      include: {
        user: true,
      },
    });
  };

  server.get("/me", async (request, reply) => {
    const hero = await getCurrentHero(request);
    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    const hr = await getHeroHrDetailsByUserId(hero.userId);
    return {
      ...hero,
      activeVacationRequest: hr.activeVacationRequest,
    };
  });

  server.patch("/me/status", async (request, reply) => {
    const { status } = request.body as { status: "ONLINE" | "OFFLINE" | "ON_DELIVERY" | "ON_BREAK" };
    const hero = await getCurrentHero(request);

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextHero = await tx.heroProfile.update({
        where: { id: hero.id },
        data: {
          status,
          lastPingAt: new Date(),
        },
      });

      if (hero.status !== status) {
        await tx.heroAvailabilityLog.create({
          data: {
            heroId: hero.id,
            fromStatus: hero.status,
            toStatus: status,
            changedBy: hero.userId,
          },
        });
      }

      return nextHero;
    });

    server.broadcast(
      "HERO_STATUS",
      {
        heroId: updated.id,
        status: updated.status,
      },
      { channels: ["live-map", "hero-status"] },
    );

    return updated;
  });

  server.post("/me/device", async (request) => {
    const body = request.body as {
      installationId?: string;
      pushToken?: string | null;
      platform?: string;
      appVersion?: string | null;
    };
    const hero = await getCurrentHero(request);

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    if (!body.installationId?.trim() || !body.platform?.trim()) {
      throw new AppError(400, "DEVICE_FIELDS_REQUIRED", "installationId and platform are required");
    }

    const updated = await prisma.heroProfile.update({
      where: { id: hero.id },
      data: {
        deviceInstallationId: body.installationId.trim(),
        pushToken: body.pushToken?.trim() || null,
        devicePlatform: body.platform.trim().toLowerCase(),
        deviceRegisteredAt: new Date(),
        lastAppVersion: body.appVersion?.trim() || null,
      },
      select: {
        id: true,
        deviceInstallationId: true,
        devicePlatform: true,
        deviceRegisteredAt: true,
      },
    });

    return {
      success: true,
      heroId: updated.id,
      installationId: updated.deviceInstallationId,
      platform: updated.devicePlatform,
      registeredAt: updated.deviceRegisteredAt?.toISOString() || null,
    };
  });

  server.post("/location", async (request, reply) => {
    const body = request.body as {
      lat: number;
      lng: number;
      battery?: number;
      orderId?: string;
      reason?: "IDLE" | "MOVING_WITH_ORDER" | "MOVING_WITHOUT_ORDER";
    };
    const hero = await getCurrentHero(request);

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    const updated = await prisma.heroProfile.update({
      where: { id: hero.id },
      data: {
        currentLat: body.lat,
        currentLng: body.lng,
        lastPingAt: new Date(),
      },
    });

    await prisma.breadcrumb.create({
      data: {
        heroId: hero.id,
        orderId: body.orderId,
        lat: body.lat,
        lng: body.lng,
        battery: body.battery,
        reason: body.reason || "IDLE",
      },
    });

    server.broadcast(
      "LOCATION_UPDATE",
      {
        heroId: hero.id,
        lat: body.lat,
        lng: body.lng,
        status: updated.status,
        updatedAt: new Date().toISOString(),
      },
      { channels: ["live-map"] },
    );

    return { success: true };
  });

  server.get("/orders/active", async (request, reply) => {
    const hero = await getCurrentHero(request);

    if (!hero) {
      return reply.status(404).send({ error: "Hero profile not found" });
    }

    return prisma.order.findMany({
      where: {
        heroId: hero.id,
        status: {
          notIn: ["DELIVERED", "FAILED", "CANCELLED"],
        },
      },
      include: {
        branch: true,
      },
      orderBy: { requestedAt: "desc" },
    });
  });

  server.patch("/orders/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, note } = request.body as {
      status: "HERO_ACCEPTED" | "PICKED_UP" | "ON_WAY" | "IN_TRANSIT" | "ARRIVED" | "FAILED";
      note?: string;
    };
    const hero = await getCurrentHero(request);

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        heroId: hero.id,
      },
    });

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (order.status === "DELIVERED") {
      throw new AppError(409, "ORDER_ALREADY_DELIVERED", "Delivered orders cannot be updated from this route");
    }

    assertHeroOrderTransition(order.status, status);

    const timestampData =
      status === "PICKED_UP"
        ? { pickedUpAt: new Date() }
        : status === "ARRIVED"
          ? { arrivedAt: new Date() }
        : status === "FAILED"
          ? { failedAt: new Date() }
          : {};

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...timestampData,
        statusHistory: {
          create: {
            status,
            changedBy: hero.userId,
            note,
            lat: hero.currentLat,
            lng: hero.currentLng,
          },
        },
      },
    });

    if (status === "FAILED") {
      await prisma.heroProfile.update({
        where: { id: hero.id },
        data: {
          status: "ONLINE",
        },
      });
    }

    server.broadcast(
      "ORDER_STATUS_UPDATE",
      {
        orderId: updated.id,
        trackingId: updated.trackingId,
        status: updated.status,
      },
      { channels: ["orders", "live-map"] },
    );

    return updated;
  });

  server.post("/orders/:id/verify-otp", async (request, reply) => {
    throw new AppError(410, "USE_POD_VERIFY_ROUTE", "Use the dedicated POD verification route for delivery confirmation");
  });

  server.post("/orders/:id/pod-photo", async (request, reply) => {
    return { url: "https://example.com/photo.jpg" };
  });

  server.get("/earnings/summary", async (request, reply) => {
    const hero = await getCurrentHero(request);

    if (!hero) {
      return reply.status(404).send({ error: "Hero profile not found" });
    }

    const [completedOrders, payouts] = await Promise.all([
      prisma.order.aggregate({
        where: {
          heroId: hero.id,
          status: "DELIVERED",
        },
        _sum: {
          heroPayout: true,
        },
        _count: {
          id: true,
        },
      }),
      prisma.payout.aggregate({
        where: { heroId: hero.id },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    return {
      deliveredOrders: completedOrders._count.id,
      pendingPayoutAmount: payouts._sum.totalAmount || 0,
      totalOrderEarnings: completedOrders._sum.heroPayout || 0,
    };
  });

  server.get("/me/compensation-summary", async (request) => {
    const hero = await getCurrentHero(request);

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    return buildHeroCompensationSummary(hero.userId);
  });

  server.get("/me/vacation", async (request) => {
    const hero = await getCurrentHero(request);

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    const hr = await getHeroHrDetailsByUserId(hero.userId);
    return {
      activeVacationRequest: hr.activeVacationRequest,
      allowances: hr.vacationAllowances,
      requests: hr.vacationRequests,
    };
  });

  server.post("/me/vacation-requests", async (request) => {
    const hero = await getCurrentHero(request);

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
    }

    const body = request.body as {
      type?: VacationType;
      startDate?: string;
      endDate?: string;
      reason?: string | null;
    };

    if (!body.type || !body.startDate || !body.endDate) {
      throw new AppError(400, "VACATION_REQUEST_FIELDS_REQUIRED", "type, startDate, and endDate are required");
    }

    const requestRecord = await createHeroVacationRequest({
      userId: hero.userId,
      type: body.type,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      reason: body.reason || null,
    });

    return {
      id: requestRecord.id,
      status: requestRecord.status,
      requestedAt: requestRecord.requestedAt.toISOString(),
    };
  });
}
