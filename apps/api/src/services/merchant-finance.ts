import {
  ContractType,
  MerchantFinanceScenario,
  SettlementCycle,
  TransactionType,
} from "@tayyar/db";
import { prisma } from "../lib/prisma";

export type FinanceDateRange = {
  from?: Date;
  to?: Date;
};

export type MerchantFinanceSummary = {
  merchantId: string;
  merchantName: string;
  merchantNameAr: string | null;
  walletBalance: number;
  financeCase: {
    id: string | null;
    type: ContractType | null;
    scenario: MerchantFinanceScenario | null;
    settlementCycle: SettlementCycle | null;
    value: number | null;
    settlementRate: number | null;
    retainerAmount: number | null;
    perOrderFee: number | null;
    currency: string;
    validFrom: string | null;
    validUntil: string | null;
    notes: string | null;
    isActive: boolean;
  };
  period: {
    from: string | null;
    to: string | null;
  };
  totals: {
    orderCount: number;
    deliveredOrders: number;
    revenue: number;
    invoicesAmount: number;
    topups: number;
    adjustments: number;
    payouts: number;
  };
};

function scenarioToContractType(scenario: MerchantFinanceScenario | null | undefined): ContractType | null {
  if (!scenario) {
    return null;
  }

  if (scenario === MerchantFinanceScenario.RETAINER) {
    return ContractType.RETAINER_MONTHLY;
  }

  if (scenario === MerchantFinanceScenario.REVENUE_SHARE) {
    return ContractType.PER_ORDER;
  }

  return ContractType.PER_ORDER;
}

function contractTypeToScenario(type: ContractType | null | undefined): MerchantFinanceScenario | null {
  if (!type) {
    return null;
  }

  if (
    type === ContractType.RETAINER_DAILY ||
    type === ContractType.RETAINER_WEEKLY ||
    type === ContractType.RETAINER_MONTHLY
  ) {
    return MerchantFinanceScenario.RETAINER;
  }

  return MerchantFinanceScenario.PER_ORDER;
}

export function buildDateRangeFilter(range: FinanceDateRange) {
  if (!range.from && !range.to) {
    return undefined;
  }

  return {
    gte: range.from,
    lte: range.to,
  };
}

export function coerceDateRange(input: { from?: string; to?: string }) {
  const from = input.from ? new Date(input.from) : undefined;
  const to = input.to ? new Date(input.to) : undefined;

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  };
}

function normalizeFinanceCase(input: {
  legacyContract: {
    id: string;
    type: ContractType;
    value: number;
    settlementRate: number | null;
    retainerAmount: number | null;
    perOrderFee: number | null;
    currency: string;
    validFrom: Date;
    validUntil: Date | null;
    notes: string | null;
    isActive: boolean;
  } | null;
  financeCase: {
    id: string;
    scenario: MerchantFinanceScenario;
    settlementCycle: SettlementCycle;
    settlementRate: number | null;
    retainerAmount: number | null;
    perOrderFee: number | null;
    currency: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    notes: string | null;
    isActive: boolean;
  } | null;
}) {
  const financeCase = input.financeCase;
  const contract = input.legacyContract;

  return {
    id: financeCase?.id || contract?.id || null,
    type: contract?.type || scenarioToContractType(financeCase?.scenario) || null,
    scenario: financeCase?.scenario || contractTypeToScenario(contract?.type) || null,
    settlementCycle: financeCase?.settlementCycle || null,
    value:
      contract?.value ??
      financeCase?.retainerAmount ??
      financeCase?.perOrderFee ??
      financeCase?.settlementRate ??
      null,
    settlementRate: financeCase?.settlementRate ?? contract?.settlementRate ?? null,
    retainerAmount: financeCase?.retainerAmount ?? contract?.retainerAmount ?? null,
    perOrderFee: financeCase?.perOrderFee ?? contract?.perOrderFee ?? null,
    currency: financeCase?.currency || contract?.currency || "EGP",
    validFrom: financeCase?.effectiveFrom?.toISOString() || contract?.validFrom?.toISOString() || null,
    validUntil: financeCase?.effectiveTo?.toISOString() || contract?.validUntil?.toISOString() || null,
    notes: financeCase?.notes || contract?.notes || null,
    isActive: financeCase?.isActive ?? contract?.isActive ?? false,
  };
}

export async function buildMerchantFinanceSummary(merchantId: string, range: FinanceDateRange = {}): Promise<MerchantFinanceSummary | null> {
  const dateRange = buildDateRangeFilter(range);
  const merchant = await prisma.merchantBrand.findUnique({
    where: { id: merchantId },
    include: {
      contracts: {
        where: { isActive: true },
        orderBy: { validFrom: "desc" },
        take: 1,
      },
      financeCase: true,
      branches: {
        select: {
          id: true,
        },
      },
      transactions: {
        where: {
          createdAt: dateRange,
        },
      },
      invoices: {
        where: {
          createdAt: dateRange,
        },
      },
    },
  });

  if (!merchant) {
    return null;
  }

  const branchIds = merchant.branches.map((branch) => branch.id);
  const orders = await prisma.order.findMany({
    where: {
      branchId: { in: branchIds.length ? branchIds : ["__none__"] },
      requestedAt: dateRange,
    },
    select: {
      id: true,
      status: true,
      deliveryFee: true,
    },
  });

  const totals = merchant.transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === TransactionType.TOPUP && transaction.status === "SUCCESS") {
        acc.topups += transaction.amount;
      }
      if (transaction.type === TransactionType.ADJUSTMENT && transaction.status === "SUCCESS") {
        acc.adjustments += transaction.amount;
      }
      if (transaction.type === TransactionType.ORDER_PAYOUT && transaction.status === "SUCCESS") {
        acc.payouts += transaction.amount;
      }
      return acc;
    },
    {
      topups: 0,
      adjustments: 0,
      payouts: 0,
    },
  );

  return {
    merchantId: merchant.id,
    merchantName: merchant.name,
    merchantNameAr: merchant.nameAr,
    walletBalance: merchant.walletBalance,
    financeCase: normalizeFinanceCase({
      legacyContract: merchant.contracts[0] || null,
      financeCase: merchant.financeCase || null,
    }),
    period: {
      from: range.from?.toISOString() || null,
      to: range.to?.toISOString() || null,
    },
    totals: {
      orderCount: orders.length,
      deliveredOrders: orders.filter((order) => order.status === "DELIVERED").length,
      revenue: orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0),
      invoicesAmount: merchant.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      topups: totals.topups,
      adjustments: totals.adjustments,
      payouts: totals.payouts,
    },
  };
}

export async function listMerchantFinanceSummaries(range: FinanceDateRange = {}) {
  const merchants = await prisma.merchantBrand.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const results = await Promise.all(
    merchants.map((merchant) => buildMerchantFinanceSummary(merchant.id, range)),
  );

  return results.filter(Boolean) as MerchantFinanceSummary[];
}
