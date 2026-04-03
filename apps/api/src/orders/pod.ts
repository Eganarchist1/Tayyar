import { FastifyPluginAsync } from "fastify";
import { prisma } from "@tayyar/db";
import { z } from "zod";
import { requireRole } from "../decorators/auth";
import { AppError } from "../lib/errors";
import { AuthService } from "../services/auth";
import { enqueueFinanceJob } from "../workers/queues";

const otpAttempts = new Map<string, { count: number; resetAt: number }>();
const heroTransitionMap: Record<string, string[]> = {
  ASSIGNED: ["HERO_ACCEPTED", "PICKED_UP", "FAILED"],
  HERO_ACCEPTED: ["PICKED_UP", "FAILED"],
  PICKED_UP: ["ON_WAY", "IN_TRANSIT", "ARRIVED", "FAILED"],
  ON_WAY: ["IN_TRANSIT", "ARRIVED", "FAILED"],
  IN_TRANSIT: ["ARRIVED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
};

async function assertHeroAccess(request: any, order: { heroId: string | null }) {
  const user = request.user as { role?: string; id?: string };
  if (user.role === "ADMIN") {
    return;
  }
  const hero = await prisma.heroProfile.findFirst({
    where: {
      user: {
        email: request.user?.email,
      },
    },
    select: { id: true },
  });
  if (!hero || !order.heroId || order.heroId !== hero.id) {
    throw new AppError(403, "ORDER_ACCESS_DENIED", "Order does not belong to the current hero");
  }
}

function assertOrderTransition(currentStatus: string, nextStatus: string) {
  const allowed = heroTransitionMap[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(409, "INVALID_ORDER_TRANSITION", `Cannot transition order from ${currentStatus} to ${nextStatus}`);
  }
}

function recordOtpAttempt(orderId: string) {
  const now = Date.now();
  const current = otpAttempts.get(orderId);
  if (!current || current.resetAt < now) {
    otpAttempts.set(orderId, {
      count: 1,
      resetAt: now + 5 * 60 * 1000,
    });
    return;
  }

  if (current.count >= 5) {
    throw new AppError(429, "OTP_RATE_LIMITED", "Too many OTP attempts for this order");
  }

  current.count += 1;
  otpAttempts.set(orderId, current);
}

export const podRoutes: FastifyPluginAsync = async (server) => {
  server.get("/track/:trackingId", async (request, reply) => {
    const { trackingId } = request.params as { trackingId: string };

    const order = await prisma.order.findUnique({
      where: { trackingId },
      include: {
        branch: true,
        hero: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!order) {
      return reply.status(404).send({ error: "Tracking record not found" });
    }

    return {
      id: order.id,
      trackingId: order.trackingId,
      orderNumber: order.orderNumber,
      status: order.status,
      requestedAt: order.requestedAt,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
      deliveryAddress: order.deliveryAddress,
      customerPhone: order.customerPhone,
      pickupLat: order.pickupLat,
      pickupLng: order.pickupLng,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      branch: {
        name: order.branch.nameAr || order.branch.name,
        address: order.branch.address,
        phone: order.branch.phone,
      },
      hero: order.hero
        ? {
            id: order.hero.id,
            name: order.hero.user.name,
            phone: order.hero.user.phone,
            status: order.hero.status,
            currentLat: order.hero.currentLat,
            currentLng: order.hero.currentLng,
          }
        : null,
    };
  });

  server.post(
    "/:orderId/arrived",
    {
      preHandler: [requireRole(["HERO", "ADMIN"])],
    },
    async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    await assertHeroAccess(request, order);

    if (order.status === "DELIVERED") {
      return {
        message: "Order already delivered",
        status: order.status,
        customerPhone: order.customerPhone,
      };
    }

    if (order.status === "ARRIVED" && order.otpHash && order.otpExpiresAt && order.otpExpiresAt > new Date()) {
      return {
        message: "OTP already generated",
        status: order.status,
        customerPhone: order.customerPhone,
      };
    }

    assertOrderTransition(order.status, "ARRIVED");

    const otp = AuthService.generateOtpCode();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "ARRIVED",
        arrivedAt: new Date(),
        otpCode: null,
        otpHash: AuthService.hashOtpCode(otp),
        otpExpiresAt,
        statusHistory: {
          create: {
            status: "ARRIVED",
            note: "Hero arrived at destination. OTP generated.",
          }
        }
      }
    });

    server.broadcast(
      "ORDER_STATUS_UPDATE",
      {
        orderId: updatedOrder.id,
        trackingId: updatedOrder.trackingId,
        status: updatedOrder.status,
      },
      { channels: ["orders", "live-map"] },
    );

    server.log.info(
      {
        orderId,
        orderNumber: order.orderNumber,
        customerPhone: order.customerPhone,
      },
      "OTP generated for delivery arrival",
    );

    return { 
      message: "OTP generated", 
      status: "ARRIVED",
      customerPhone: order.customerPhone 
    };
    },
  );

  server.post(
    "/:orderId/verify",
    {
      preHandler: [requireRole(["HERO", "ADMIN"])],
    },
    async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const bodySchema = z.object({
      otp: z.string().length(4),
      notes: z.string().optional()
    });

    const body = bodySchema.parse(request.body);

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    await assertHeroAccess(request, order);

    if (order.status === "DELIVERED" && order.otpVerifiedAt) {
      return {
        message: "Delivery already confirmed",
        status: "DELIVERED",
        alreadyCompleted: true,
      };
    }

    assertOrderTransition(order.status, "DELIVERED");
    recordOtpAttempt(orderId);

    if (!order.otpHash || !order.otpExpiresAt || order.otpExpiresAt <= new Date()) {
      throw new AppError(400, "OTP_EXPIRED", "OTP code expired");
    }

    if (!AuthService.verifyOtpCode(body.otp, order.otpHash)) {
      throw new AppError(400, "INVALID_OTP_CODE", "Invalid OTP code");
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
        otpVerifiedAt: new Date(),
        otpCode: null,
        otpHash: null,
        otpExpiresAt: null,
        podNotes: body.notes,
        statusHistory: {
          create: {
            status: "DELIVERED",
            note: "OTP verified. Delivery successful. Financials processed.",
          }
        }
      }
    });

    server.broadcast(
      "ORDER_STATUS_UPDATE",
      {
        orderId: updatedOrder.id,
        trackingId: updatedOrder.trackingId,
        status: updatedOrder.status,
      },
      { channels: ["orders", "live-map"] },
    );

    try {
      await enqueueFinanceJob({ orderId, source: "pod_verify" }, server.log);
    } catch (err) {
      server.log.error(
        {
          err,
          orderId,
          orderNumber: order.orderNumber,
        },
        "Delivery confirmed but billing settlement failed",
      );
    }

    otpAttempts.delete(orderId);

    return { 
      message: "Delivery confirmed", 
      status: "DELIVERED" 
    };
    },
  );
};
