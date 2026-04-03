import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { listAuditEvents, recordAuditEvent } from "./audit-events";

type CustomerUpdateInput = {
  name?: string | null;
  phone?: string;
  addresses?: Array<{
    id?: string;
    branchId: string;
    name?: string | null;
    addressLabel: string;
    lat: number;
    lng: number;
    remove?: boolean;
  }>;
};

type AuditActor = {
  id?: string | null;
  email?: string | null;
};

function normalizeText(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDuplicateReasons(customer: { phone: string; name: string | null; lastAddress: string | null }, peer: { phone: string; name: string | null; lastAddress: string | null }) {
  const reasons: string[] = [];
  if (customer.phone && customer.phone === peer.phone) {
    reasons.push("same_phone");
  }

  const customerName = normalizeText(customer.name);
  const peerName = normalizeText(peer.name);
  if (customerName && peerName && (customerName === peerName || customerName.includes(peerName) || peerName.includes(customerName))) {
    reasons.push("similar_name");
  }

  const customerAddress = normalizeText(customer.lastAddress);
  const peerAddress = normalizeText(peer.lastAddress);
  if (customerAddress && peerAddress && (customerAddress === peerAddress || customerAddress.includes(peerAddress) || peerAddress.includes(customerAddress))) {
    reasons.push("address_overlap");
  }

  return reasons;
}

async function findDuplicateCandidates(customer: {
  id: string;
  phone: string;
  name: string | null;
  lastAddress: string | null;
  merchantId: string;
}) {
  const nameProbe = normalizeText(customer.name).split(" ").filter(Boolean)[0];
  const addressProbe = normalizeText(customer.lastAddress).split(" ").filter(Boolean)[0];
  const peers = await prisma.customerProfile.findMany({
    where: {
      id: { not: customer.id },
      OR: [
        { phone: customer.phone },
        nameProbe ? { name: { contains: nameProbe, mode: "insensitive" } } : undefined,
        addressProbe ? { lastAddress: { contains: addressProbe, mode: "insensitive" } } : undefined,
      ].filter(Boolean) as any,
    },
    include: {
      merchant: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return peers
    .map((peer) => {
      const reasons = buildDuplicateReasons(customer, peer);
      if (!reasons.length) {
        return null;
      }

      return {
        id: peer.id,
        phone: peer.phone,
        name: peer.name,
        merchant: {
          id: peer.merchant.id,
          name: peer.merchant.name,
          nameAr: peer.merchant.nameAr,
        },
        lastAddress: peer.lastAddress,
        totalOrders: peer.totalOrders,
        confidence: reasons.includes("same_phone") ? "high" : reasons.length > 1 ? "medium" : "low",
        reasons,
      };
    })
    .filter(Boolean);
}

async function getMerchantScope(merchantId: string) {
  const brand = await prisma.merchantBrand.findUnique({
    where: { id: merchantId },
    include: {
      branches: {
        select: {
          id: true,
          name: true,
          nameAr: true,
        },
      },
    },
  });

  if (!brand) {
    throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
  }

  return brand;
}

async function buildCustomerListRow(
  customer: {
    id: string;
    phone: string;
    name: string | null;
    merchantId: string;
    totalOrders: number;
    lastAddress: string | null;
    createdAt: Date;
  },
  merchant: {
    id: string;
    name: string;
    nameAr: string | null;
    branches: Array<{ id: string }>;
  },
) {
  const branchIds = merchant.branches.map((branch) => branch.id);
  const [addressCount, lastOrder] = await Promise.all([
    prisma.customerAddressVault.count({
      where: {
        phone: customer.phone,
        branchId: { in: branchIds },
      },
    }),
    prisma.order.findFirst({
      where: {
        branchId: { in: branchIds },
        OR: [
          { customerProfileId: customer.id },
          { customerPhone: customer.phone },
        ],
      },
      orderBy: { requestedAt: "desc" },
      select: { requestedAt: true },
    }),
  ]);

  return {
    id: customer.id,
    phone: customer.phone,
    name: customer.name,
    merchant: {
      id: merchant.id,
      name: merchant.name,
      nameAr: merchant.nameAr,
    },
    totalOrders: customer.totalOrders,
    addressCount,
    lastAddress: customer.lastAddress,
    lastOrderAt: lastOrder?.requestedAt.toISOString() || null,
    createdAt: customer.createdAt.toISOString(),
  };
}

async function buildCustomerDetail(
  customer: {
    id: string;
    phone: string;
    name: string | null;
    merchantId: string;
    totalOrders: number;
    lastAddress: string | null;
    createdAt: Date;
    updatedAt: Date;
    merchant: {
      id: string;
      name: string;
      nameAr: string | null;
      branches: Array<{ id: string; name: string; nameAr: string | null }>;
    };
  },
) {
  const branchIds = customer.merchant.branches.map((branch) => branch.id);
  const [addresses, recentOrders, duplicateCandidates, auditTrail] = await Promise.all([
    prisma.customerAddressVault.findMany({
      where: {
        phone: customer.phone,
        branchId: { in: branchIds },
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            nameAr: true,
          },
        },
      },
      orderBy: [{ usageCount: "desc" }, { lastUsedAt: "desc" }],
    }),
    prisma.order.findMany({
      where: {
        branchId: { in: branchIds },
        OR: [
          { customerProfileId: customer.id },
          { customerPhone: customer.phone },
        ],
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            nameAr: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
        take: 8,
    }),
    findDuplicateCandidates(customer),
    listAuditEvents("CUSTOMER", customer.id, 12),
  ]);

  return {
    id: customer.id,
    phone: customer.phone,
    name: customer.name,
    totalOrders: customer.totalOrders,
    lastAddress: customer.lastAddress,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    merchant: {
      id: customer.merchant.id,
      name: customer.merchant.name,
      nameAr: customer.merchant.nameAr,
    },
    duplicateCandidates,
    auditTrail,
    addresses: addresses.map((address) => ({
      id: address.id,
      phone: address.phone,
      name: address.name,
      lat: address.lat,
      lng: address.lng,
      branchId: address.branchId,
      branchName: address.branch.name,
      branchNameAr: address.branch.nameAr,
      addressLabel: address.addressLabel,
      usageCount: address.usageCount,
      lastUsedAt: address.lastUsedAt.toISOString(),
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      requestedAt: order.requestedAt.toISOString(),
      deliveryAddress: order.deliveryAddress,
      branch: {
        id: order.branch.id,
        name: order.branch.name,
        nameAr: order.branch.nameAr,
      },
    })),
  };
}

async function getScopedCustomer(merchantId: string, customerId: string) {
  return prisma.customerProfile.findFirst({
    where: {
      id: customerId,
      merchantId,
    },
    include: {
      merchant: {
        include: {
          branches: {
            select: {
              id: true,
              name: true,
              nameAr: true,
            },
          },
        },
      },
    },
  });
}

export async function listCustomersForMerchant(merchantId: string, query?: string) {
  const merchant = await getMerchantScope(merchantId);
  const customers = await prisma.customerProfile.findMany({
    where: {
      merchantId,
      OR: query
        ? [
            { phone: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { lastAddress: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: [{ totalOrders: "desc" }, { updatedAt: "desc" }],
  });

  return Promise.all(customers.map((customer) => buildCustomerListRow(customer, merchant)));
}

export async function getCustomerDetailForMerchant(merchantId: string, customerId: string) {
  const customer = await getScopedCustomer(merchantId, customerId);
  if (!customer) {
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  }

  return buildCustomerDetail(customer);
}

export async function updateCustomerForMerchant(merchantId: string, customerId: string, input: CustomerUpdateInput) {
  const customer = await getScopedCustomer(merchantId, customerId);
  if (!customer) {
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  }

  const nextPhone = input.phone?.trim() || customer.phone;
  const nextName = input.name === undefined ? customer.name : input.name?.trim() || null;
  const branchIds = customer.merchant.branches.map((branch) => branch.id);

  const updated = await prisma.$transaction(async (tx) => {
    if (nextPhone !== customer.phone) {
      const duplicate = await tx.customerProfile.findUnique({
        where: { phone: nextPhone },
        select: { id: true },
      });

      if (duplicate && duplicate.id !== customer.id) {
        throw new AppError(409, "CUSTOMER_PHONE_CONFLICT", "Phone number already belongs to another customer");
      }

      await tx.customerAddressVault.updateMany({
        where: {
          phone: customer.phone,
          branchId: { in: branchIds },
        },
        data: { phone: nextPhone },
      });

      await tx.order.updateMany({
        where: {
          branchId: { in: branchIds },
          OR: [
            { customerProfileId: customer.id },
            { customerPhone: customer.phone },
          ],
        },
        data: { customerPhone: nextPhone },
      });
    }

    const profile = await tx.customerProfile.update({
      where: { id: customer.id },
      data: {
        name: nextName,
        phone: nextPhone,
      },
      include: {
        merchant: {
          include: {
            branches: {
              select: {
                id: true,
                name: true,
                nameAr: true,
              },
            },
          },
        },
      },
    });

    if (input.addresses?.length) {
      for (const address of input.addresses) {
        if (!branchIds.includes(address.branchId)) {
          throw new AppError(400, "INVALID_BRANCH_SCOPE", "Address branch is outside the current merchant scope");
        }

        if (address.id) {
          const existingAddress = await tx.customerAddressVault.findFirst({
            where: {
              id: address.id,
              phone: nextPhone,
              branchId: { in: branchIds },
            },
          });

          if (!existingAddress) {
            throw new AppError(404, "ADDRESS_NOT_FOUND", "Address not found");
          }

          if (address.remove) {
            await tx.customerAddressVault.delete({
              where: { id: existingAddress.id },
            });
            continue;
          }

          await tx.customerAddressVault.update({
            where: { id: existingAddress.id },
            data: {
              branchId: address.branchId,
              name: address.name?.trim() || profile.name,
              addressLabel: address.addressLabel.trim(),
              lat: address.lat,
              lng: address.lng,
            },
          });
          continue;
        }

        if (address.remove) {
          continue;
        }

        await tx.customerAddressVault.create({
          data: {
            branchId: address.branchId,
            phone: nextPhone,
            name: address.name?.trim() || profile.name,
            addressLabel: address.addressLabel.trim(),
            lat: address.lat,
            lng: address.lng,
          },
        });
      }
    }

    return profile;
  });

  return buildCustomerDetail(updated);
}

export async function listCustomersForAdmin(query?: string, merchantId?: string) {
  const customers = await prisma.customerProfile.findMany({
    where: {
      merchantId: merchantId || undefined,
      OR: query
        ? [
            { phone: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { lastAddress: { contains: query, mode: "insensitive" } },
            { merchant: { name: { contains: query, mode: "insensitive" } } },
            { merchant: { nameAr: { contains: query, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: {
      merchant: {
        include: {
          branches: {
            select: {
              id: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return Promise.all(customers.map((customer) => buildCustomerListRow(customer, customer.merchant)));
}

export async function getCustomerDetailForAdmin(customerId: string) {
  const customer = await prisma.customerProfile.findUnique({
    where: { id: customerId },
    include: {
      merchant: {
        include: {
          branches: {
            select: {
              id: true,
              name: true,
              nameAr: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  }

  return buildCustomerDetail(customer);
}

export async function updateCustomerForAdmin(customerId: string, input: CustomerUpdateInput, actor?: AuditActor) {
  const customer = await prisma.customerProfile.findUnique({
    where: { id: customerId },
    select: { merchantId: true },
  });

  if (!customer) {
    throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  }

  const before = await getCustomerDetailForAdmin(customerId);
  const updated = await updateCustomerForMerchant(customer.merchantId, customerId, input);

  await recordAuditEvent({
    actorUserId: actor?.id,
    actorEmail: actor?.email,
    action: "CUSTOMER_UPDATED",
    entityType: "CUSTOMER",
    entityId: customerId,
    summary: {
      phoneChanged: before.phone !== updated.phone,
      addressCount: updated.addresses.length,
    },
    before: {
      name: before.name,
      phone: before.phone,
      lastAddress: before.lastAddress,
      addressCount: before.addresses.length,
    },
    after: {
      name: updated.name,
      phone: updated.phone,
      lastAddress: updated.lastAddress,
      addressCount: updated.addresses.length,
    },
  });

  return updated;
}
