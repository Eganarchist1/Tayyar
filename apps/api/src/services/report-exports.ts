import { TransactionType } from "@tayyar/db";
import { prisma } from "../lib/prisma";

type ExportFormat = "csv" | "json";
export type ExportKey = "orders" | "payouts" | "invoices" | "summary" | "finance";

export type ReportExportOptions = {
  merchantId?: string;
  from?: Date;
  to?: Date;
};

function csvEscape(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }

  return stringValue;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ];

  return lines.join("\n");
}

function buildCreatedAtFilter(options: ReportExportOptions) {
  if (!options.from && !options.to) {
    return undefined;
  }

  return {
    gte: options.from,
    lte: options.to,
  };
}

async function getMerchantBranchIds(merchantId?: string) {
  if (!merchantId) {
    return null;
  }

  const branches = await prisma.branch.findMany({
    where: { brandId: merchantId },
    select: { id: true },
  });

  return branches.map((branch) => branch.id);
}

async function getOrdersExportRows(options: ReportExportOptions) {
  const branchIds = await getMerchantBranchIds(options.merchantId);
  const orders = await prisma.order.findMany({
    where: {
      branchId: branchIds ? { in: branchIds.length ? branchIds : ["__none__"] } : undefined,
      requestedAt: buildCreatedAtFilter(options),
    },
    include: {
      branch: {
        include: {
          brand: true,
        },
      },
      hero: {
        include: {
          user: true,
        },
      },
      zone: true,
    },
    orderBy: { requestedAt: "desc" },
  });

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    trackingId: order.trackingId,
    status: order.status,
    requestedAt: order.requestedAt.toISOString(),
    assignedAt: order.assignedAt?.toISOString() || "",
    deliveredAt: order.deliveredAt?.toISOString() || "",
    merchant: order.branch.brand.name,
    merchantAr: order.branch.brand.nameAr || "",
    branch: order.branch.name,
    branchAr: order.branch.nameAr || "",
    zone: order.zone.name,
    zoneAr: order.zone.nameAr || "",
    hero: order.hero?.user.name || "",
    customerName: order.customerName || "",
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress || "",
    deliveryFee: order.deliveryFee || 0,
    collectionAmount: order.collectionAmount || 0,
    paymentMode: order.paymentMode || "",
  }));
}

async function getPayoutExportRows(options: ReportExportOptions) {
  const payouts = await prisma.payout.findMany({
    where: {
      createdAt: buildCreatedAtFilter(options),
    },
    include: {
      hero: {
        include: {
          user: true,
          assignments: {
            where: { isActive: true },
            include: {
              branch: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = options.merchantId
    ? payouts.filter((payout) => payout.hero.assignments.some((assignment) => assignment.branch.brandId === options.merchantId))
    : payouts;

  return filtered.map((payout) => ({
    payoutId: payout.id,
    heroName: payout.hero.user.name,
    heroEmail: payout.hero.user.email,
    status: payout.status,
    currency: payout.currency,
    totalAmount: payout.totalAmount,
    baseSalary: payout.baseSalary,
    orderBonus: payout.orderBonus,
    penalties: payout.penalties,
    periodStart: payout.periodStart.toISOString(),
    periodEnd: payout.periodEnd.toISOString(),
    createdAt: payout.createdAt.toISOString(),
  }));
}

async function getInvoicesExportRows(options: ReportExportOptions) {
  const invoices = await prisma.invoice.findMany({
    where: {
      brandId: options.merchantId,
      createdAt: buildCreatedAtFilter(options),
    },
    include: {
      brand: true,
      lineItems: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((invoice) => ({
    invoiceId: invoice.id,
    merchant: invoice.brand.name,
    merchantAr: invoice.brand.nameAr || "",
    status: invoice.status,
    currency: invoice.currency,
    totalAmount: invoice.totalAmount,
    periodStart: invoice.periodStart.toISOString(),
    periodEnd: invoice.periodEnd.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    paidAt: invoice.paidAt?.toISOString() || "",
    lineItems: invoice.lineItems.length,
    createdAt: invoice.createdAt.toISOString(),
  }));
}

async function getFinanceExportRows(options: ReportExportOptions) {
  const [ledgerEntries, transactions] = await Promise.all([
    prisma.financeLedgerEntry.findMany({
      where: {
        merchantId: options.merchantId,
        occurredAt: buildCreatedAtFilter(options),
      },
      include: {
        merchant: true,
        order: true,
      },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        merchantId: options.merchantId,
        createdAt: buildCreatedAtFilter(options),
      },
      include: {
        merchant: true,
        order: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const ledgerRows = ledgerEntries.map((entry) => ({
    transactionId: entry.id,
    merchant: entry.merchant?.name || "",
    merchantAr: entry.merchant?.nameAr || "",
    type: entry.entryType,
    status: "POSTED",
    amount: entry.amount,
    currency: entry.currency,
    orderNumber: entry.order?.orderNumber || "",
    reference: entry.reference || "",
    description: entry.description || "",
    createdAt: entry.occurredAt.toISOString(),
    direction: entry.amount < 0 ? "debit" : "credit",
    source: "ledger",
  }));

  const legacyRows = transactions.map((transaction) => ({
    transactionId: transaction.id,
    merchant: transaction.merchant?.name || "",
    merchantAr: transaction.merchant?.nameAr || "",
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency,
    orderNumber: transaction.order?.orderNumber || "",
    reference: transaction.reference || "",
    description: transaction.description || "",
    createdAt: transaction.createdAt.toISOString(),
    direction:
      transaction.type === TransactionType.ORDER_FEE || transaction.amount < 0 ? "debit" : "credit",
    source: "transaction",
  }));

  return ledgerRows.length ? ledgerRows : legacyRows;
}

async function getSummaryExportPayload(options: ReportExportOptions) {
  const [orders, payouts, invoices, merchants, heroes, zones, financeRows] = await Promise.all([
    getOrdersExportRows(options),
    getPayoutExportRows(options),
    getInvoicesExportRows(options),
    prisma.merchantBrand.count({ where: options.merchantId ? { id: options.merchantId } : undefined }),
    prisma.heroProfile.count(),
    prisma.zone.count({ where: { isActive: true } }),
    getFinanceExportRows(options),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      merchantId: options.merchantId || null,
      from: options.from?.toISOString() || null,
      to: options.to?.toISOString() || null,
    },
    stats: {
      orders: orders.length,
      payouts: payouts.length,
      invoices: invoices.length,
      merchants,
      heroes,
      activeZones: zones,
      financeRows: financeRows.length,
    },
  };
}

export async function buildAdminReportExport(key: ExportKey, format: ExportFormat, options: ReportExportOptions = {}) {
  if (key === "summary") {
    const summary = await getSummaryExportPayload(options);
    return {
      filename: `tayyar-summary.${format}`,
      contentType: format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      body:
        format === "csv"
          ? toCsv([
              {
                generatedAt: summary.generatedAt,
                merchantId: summary.filters.merchantId,
                from: summary.filters.from,
                to: summary.filters.to,
                orders: summary.stats.orders,
                payouts: summary.stats.payouts,
                invoices: summary.stats.invoices,
                merchants: summary.stats.merchants,
                heroes: summary.stats.heroes,
                activeZones: summary.stats.activeZones,
                financeRows: summary.stats.financeRows,
              },
            ])
          : JSON.stringify(summary, null, 2),
    };
  }

  const rows =
    key === "orders"
      ? await getOrdersExportRows(options)
      : key === "payouts"
        ? await getPayoutExportRows(options)
        : key === "invoices"
          ? await getInvoicesExportRows(options)
          : await getFinanceExportRows(options);

  return {
    filename: `tayyar-${key}${options.merchantId ? `-${options.merchantId}` : ""}.${format}`,
    contentType: format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
    body: format === "csv" ? toCsv(rows) : JSON.stringify(rows, null, 2),
  };
}
