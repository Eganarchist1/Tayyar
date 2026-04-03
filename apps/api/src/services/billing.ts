import { prisma } from "../lib/prisma";
import { TransactionType, TransactionStatus } from "@tayyar/db";
import { AppError } from "../lib/errors";

export class BillingService {
  /**
   * Deducts funds from a merchant and starts the payout flow for a completed order.
   */
  static async processOrderCompletion(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          branch: { include: { brand: true } },
          hero: true,
          zone: true,
          transactions: {
            where: {
              type: { in: ["ORDER_FEE", "ORDER_PAYOUT"] },
              status: "SUCCESS",
            },
          },
        },
      });

      if (!order || !order.heroId || !order.branch.brandId || !order.hero) {
        throw new AppError(409, "INVALID_ORDER_STATE", "Invalid order data for billing processing");
      }

      const successfulFee = order.transactions.find((transaction) => transaction.type === "ORDER_FEE");
      const successfulPayout = order.transactions.find((transaction) => transaction.type === "ORDER_PAYOUT");

      if (successfulFee && successfulPayout) {
        return { status: "already_processed", orderId };
      }

      if (successfulFee || successfulPayout) {
        throw new AppError(
          409,
          "PARTIAL_SETTLEMENT_DETECTED",
          "Order settlement is partially recorded and requires operator intervention",
          {
            orderId,
            successfulFee: Boolean(successfulFee),
            successfulPayout: Boolean(successfulPayout),
          },
        );
      }

      const { brand } = order.branch;
      const { hero } = order;
      const { zone } = order;

      const baseFee = zone.baseFee;
      const kmRate = zone.kmRate;
      const totalFee = baseFee + (order.distanceKm || 0) * kmRate;
      const heroPayout = totalFee * 0.8;

      if (brand.walletBalance < totalFee) {
        await tx.transaction.create({
          data: {
            type: "ORDER_FEE",
            status: "FAILED",
            amount: totalFee,
            merchantId: brand.id,
            orderId: order.id,
            description: `Insufficient merchant balance for order ${order.orderNumber}`,
            metadata: {
              code: "MERCHANT_BALANCE_INSUFFICIENT",
              walletBalance: brand.walletBalance,
            },
          },
        });

        throw new AppError(
          409,
          "MERCHANT_BALANCE_INSUFFICIENT",
          "Merchant balance is insufficient to settle this order",
          {
            merchantId: brand.id,
            orderId: order.id,
            requiredAmount: totalFee,
            currentBalance: brand.walletBalance,
          },
        );
      }

      await tx.merchantBrand.update({
        where: { id: brand.id },
        data: { walletBalance: { decrement: totalFee } },
      });

      await tx.transaction.create({
        data: {
          type: "ORDER_FEE",
          status: "SUCCESS",
          amount: totalFee,
          merchantId: brand.id,
          orderId: order.id,
          description: `Delivery fee for order ${order.orderNumber}`,
        },
      });

      await tx.heroProfile.update({
        where: { id: hero.id },
        data: {
          walletBalance: { increment: heroPayout },
          totalEarnings: { increment: heroPayout },
        },
      });

      await tx.transaction.create({
        data: {
          type: "ORDER_PAYOUT",
          status: "SUCCESS",
          amount: heroPayout,
          heroId: hero.id,
          orderId: order.id,
          description: `Earnings for order ${order.orderNumber}`,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          deliveryFee: totalFee,
          heroPayout,
        },
      });

      return { status: "processed", orderId };
    });
  }

  static async topupMerchant(merchantId: string, amount: number, reference: string) {
    if (!merchantId) {
      throw new AppError(400, "MERCHANT_REQUIRED", "Merchant identifier is required");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, "INVALID_TOPUP_AMOUNT", "Top-up amount must be greater than zero");
    }

    return prisma.$transaction(async (tx) => {
      await tx.merchantBrand.update({
        where: { id: merchantId },
        data: { walletBalance: { increment: amount } }
      });

      return tx.transaction.create({
        data: {
          type: "TOPUP",
          status: "SUCCESS",
          amount,
          merchantId,
          reference,
          description: "Merchant wallet top-up"
        }
      });
    });
  }

  static async requestHeroWithdrawal(heroId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(400, "INVALID_WITHDRAWAL_AMOUNT", "Withdrawal amount must be greater than zero");
    }

    const hero = await prisma.heroProfile.findUnique({ where: { id: heroId } });
    
    if (!hero || hero.walletBalance < amount) {
      throw new AppError(409, "INSUFFICIENT_FUNDS", "Insufficient funds");
    }

    return prisma.$transaction(async (tx) => {
      await tx.heroProfile.update({
        where: { id: heroId },
        data: { walletBalance: { decrement: amount } }
      });

      return tx.transaction.create({
        data: {
          type: "WITHDRAWAL",
          status: "PENDING",
          amount,
          heroId,
          description: "Hero payout withdrawal request",
          metadata: {
            reservation: "wallet_hold",
          },
        }
      });
    });
  }
}
