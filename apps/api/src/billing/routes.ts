import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { BillingService } from "../services/billing";
import { requireRole } from "../decorators/auth";
import { AppError } from "../lib/errors";

function parseBody<T>(body: unknown, schema: z.ZodSchema<T>) {
  if (typeof body === "string") {
    try {
      return schema.parse(JSON.parse(body));
    } catch {
      throw new AppError(400, "VALIDATION_ERROR", "Request validation failed");
    }
  }

  return schema.parse(body);
}

export default async function billingRoutes(server: FastifyInstance) {
  // Get wallet balance and transaction history
  server.get("/wallet", {
    preHandler: [requireRole(["MERCHANT_OWNER", "HERO", "ADMIN"])],
  }, async (request, reply) => {
    const userEmail = (request.user as any).email;
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { 
        heroProfile: true, 
        merchantOwnership: true 
      }
    });

    if (!user) return reply.status(404).send({ message: "User not found" });

    let balance = 0;
    let transactions: Array<Record<string, unknown>> = [];

    if (user.role === "HERO" && user.heroProfile) {
      balance = user.heroProfile.walletBalance;
      transactions = await prisma.transaction.findMany({
        where: { heroId: user.heroProfile.id },
        orderBy: { createdAt: "desc" },
        take: 50
      });
    } else if (user.role === "MERCHANT_OWNER" && user.merchantOwnership) {
      balance = user.merchantOwnership.walletBalance;
      transactions = await prisma.transaction.findMany({
        where: { merchantId: user.merchantOwnership.id },
        orderBy: { createdAt: "desc" },
        take: 50
      });
    }

    return { balance, transactions };
  });

  // Merchant Top-up (Simulated/Mock for now)
  server.post("/merchant/topup", {
    preHandler: [requireRole(["MERCHANT_OWNER"])]
  }, async (request, reply) => {
    const body = parseBody(request.body, z.object({
      amount: z.coerce.number().positive(),
      reference: z.string().min(1),
    }));
    const userEmail = (request.user as any).email;
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { merchantOwnership: true },
    });

    if (!user?.merchantOwnership) {
      throw new AppError(403, "MERCHANT_ACCOUNT_REQUIRED", "Merchant account not found for current user");
    }

    return BillingService.topupMerchant(user.merchantOwnership.id, body.amount, body.reference);
  });

  server.post("/admin/merchant-topup", {
    preHandler: [requireRole(["ADMIN"])],
  }, async (request, reply) => {
    const body = parseBody(request.body, z.object({
      merchantId: z.string().min(1),
      amount: z.coerce.number().positive(),
      reference: z.string().min(1),
    }));
    return BillingService.topupMerchant(body.merchantId, body.amount, body.reference);
  });

  // Hero Withdrawal Request
  server.post("/hero/withdraw", {
    preHandler: [requireRole(["HERO"])]
  }, async (request, reply) => {
    const userEmail = (request.user as any).email;
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { heroProfile: true }
    });

    if (!user?.heroProfile) {
      throw new AppError(403, "FORBIDDEN", "Forbidden");
    }

    const body = parseBody(request.body, z.object({
      amount: z.coerce.number().positive(),
    }));
    return BillingService.requestHeroWithdrawal(user.heroProfile.id, body.amount);
  });

  // Admin: Global Ledger
  server.get("/admin/ledger", {
    preHandler: [requireRole(["ADMIN"])]
  }, async (request, reply) => {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        merchant: true,
        hero: { include: { user: true } },
        order: true
      },
      take: 100
    });

    const stats = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCESS" }
    });

    return { stats, transactions };
  });
}
