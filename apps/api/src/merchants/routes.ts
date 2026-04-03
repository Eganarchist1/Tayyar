import { Prisma } from "@tayyar/db";
import { FastifyInstance } from "fastify";
import { requireRole } from "../decorators/auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { parseObjectBody } from "../lib/request-body";
import { CustomerLocationRequestService } from "../services/location-requests";
import {
  getCustomerDetailForMerchant,
  listCustomersForMerchant,
  updateCustomerForMerchant,
} from "../services/customer-management";
import { GeocodingService } from "../services/geocoding";
import { raiseOperationalAlert } from "../services/operational-alerts";
import { enqueueAssignmentJob } from "../workers/queues";

async function getCurrentMerchantBrand(userEmail: string) {
  return prisma.merchantBrand.findFirst({
    where: { owner: { email: userEmail } },
    include: {
      branches: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function getCurrentManagedBranch(userEmail: string) {
  return prisma.branch.findFirst({
    where: {
      manager: {
        email: userEmail,
      },
    },
    include: {
      brand: true,
    },
  });
}

function merchantOrderInclude() {
  return {
    branch: true,
    zone: true,
    customerAddress: true,
    hero: {
      include: {
        user: true,
        zone: true,
      },
    },
    statusHistory: {
      orderBy: {
        createdAt: "asc" as const,
      },
    },
  };
}

async function createNextOrderNumber(tx: Prisma.TransactionClient) {
  const sequence = await tx.orderSequence.create({ data: {} });
  const year = new Date().getFullYear();
  return `TY-${year}-${String(sequence.id).padStart(6, "0")}`;
}

export default async function merchantRoutes(server: FastifyInstance) {
  server.addHook("onRequest", requireRole(["MERCHANT_OWNER", "BRANCH_MANAGER", "ADMIN"]));

  server.get("/dashboard", async (request, reply) => {
    // Basic stats for the merchant brand
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);
    const branchIds = brand?.branches.map((branch: { id: string }) => branch.id) || [];
    const [orderCount, activeOrders] = await Promise.all([
      prisma.order.count({
        where: { branchId: { in: branchIds } },
      }),
      prisma.order.count({
        where: {
          branchId: { in: branchIds },
          status: { notIn: ["DELIVERED", "FAILED", "CANCELLED"] },
        },
      }),
    ]);

    return { 
      brandName: brand?.name,
      branchCount: brand?.branches.length || 0,
      totalOrders: orderCount,
      activeOrders,
      status: brand?.isActive ? "Active" : "Inactive"
    };
  });

  server.get("/bootstrap", async (request, reply) => {
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        nameAr: true,
        city: true,
        baseFee: true,
      },
    });

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        nameAr: brand.nameAr,
      },
      branches: brand.branches,
      zones,
    };
  });

  server.post("/orders", async (request, reply) => {
    const data = parseObjectBody<any>(request.body);
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    const savedAddress = data.customerAddressId
      ? await prisma.customerAddressVault.findFirst({
          where: {
            id: data.customerAddressId,
            phone: data.customerPhone,
            branch: {
              brandId: brand.id,
            },
          },
        })
      : null;

    const branch =
      brand.branches.find((item: { id: string }) => item.id === data.branchId) ||
      (savedAddress ? brand.branches.find((item: { id: string }) => item.id === savedAddress.branchId) : undefined);
    if (!branch) {
      throw new AppError(400, "INVALID_BRANCH", "Invalid branchId for current merchant");
    }

    const zone = data.zoneId
      ? await prisma.zone.findUnique({
          where: { id: data.zoneId },
        })
      : await prisma.zone.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        });

    if (!zone) {
      throw new AppError(400, "INVALID_ZONE", "Invalid zoneId");
    }

    const shouldSaveConfirmedAddress = Boolean(data.saveConfirmedAddress);

    const deliveryAddress = savedAddress?.addressLabel ?? data.deliveryAddress;
    if (!deliveryAddress || !String(deliveryAddress).trim()) {
      throw new AppError(400, "DELIVERY_ADDRESS_REQUIRED", "A delivery address is required");
    }

    const deliveryLat = typeof savedAddress?.lat === "number" ? savedAddress.lat : typeof data.deliveryLat === "number" ? data.deliveryLat : null;
    const deliveryLng = typeof savedAddress?.lng === "number" ? savedAddress.lng : typeof data.deliveryLng === "number" ? data.deliveryLng : null;

    if (deliveryLat === null || deliveryLng === null) {
      throw new AppError(
        400,
        "DELIVERY_LOCATION_REQUIRED",
        "Choose a saved address or confirm the address on the map before creating the order",
      );
    }

    const order = await prisma.$transaction(
      async (tx) => {
        const customerProfile = await tx.customerProfile.upsert({
          where: { phone: data.customerPhone },
          update: {
            name: data.customerName,
            lastAddress: deliveryAddress,
            totalOrders: { increment: 1 },
          },
          create: {
            phone: data.customerPhone,
            name: data.customerName,
            lastAddress: deliveryAddress,
            addresses: [],
            totalOrders: 1,
            merchantId: brand.id,
          },
        });

        const customerAddress = savedAddress
          ? await tx.customerAddressVault.update({
              where: { id: savedAddress.id },
              data: {
                name: data.customerName,
                addressLabel: deliveryAddress,
                usageCount: { increment: 1 },
                lastUsedAt: new Date(),
              },
            })
          : shouldSaveConfirmedAddress && deliveryLat && deliveryLng
            ? await tx.customerAddressVault.upsert({
                where: {
                  branchId_phone_lat_lng: {
                    branchId: branch.id,
                    phone: data.customerPhone,
                    lat: deliveryLat,
                    lng: deliveryLng,
                  },
                },
                update: {
                  name: data.customerName,
                  addressLabel: deliveryAddress,
                  usageCount: { increment: 1 },
                  lastUsedAt: new Date(),
                },
                create: {
                  branchId: branch.id,
                  phone: data.customerPhone,
                  name: data.customerName,
                  lat: deliveryLat,
                  lng: deliveryLng,
                  addressLabel: deliveryAddress,
                },
              })
            : null;

        const orderNumber = await createNextOrderNumber(tx);

        return tx.order.create({
          data: {
            orderNumber,
            branchId: branch.id,
            zoneId: zone.id,
            customerAddressId: customerAddress?.id,
            customerProfileId: customerProfile.id,
            customerPhone: data.customerPhone,
            customerName: data.customerName,
            deliveryLat,
            deliveryLng,
            deliveryAddress,
            pickupLat: data.pickupLat ?? branch.lat,
            pickupLng: data.pickupLng ?? branch.lng,
            model: "POOL",
            deliveryFee: zone.baseFee,
            collectionAmount:
              typeof data.collectionAmount === "number" && Number.isFinite(data.collectionAmount)
                ? Math.max(0, data.collectionAmount)
                : null,
            paymentMode: data.paymentMode === "PREPAID" ? "PREPAID" : "COLLECT_ON_DELIVERY",
            statusHistory: {
              create: {
                status: "REQUESTED",
                changedBy: (request.user as any).id || userEmail,
                note: data.notes,
              },
            },
          },
          include: {
            branch: true,
            zone: true,
            hero: { include: { user: true } },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    enqueueAssignmentJob({ orderId: order.id, source: "merchant_order" }, server.log).catch((error) => {
      server.log.error({ err: error, orderId: order.id }, "Auto-assignment failed");
    });

    return order;
  });

  server.get("/orders/:id", async (request) => {
    const { id } = request.params as { id: string };
    const userEmail = (request.user as any).email;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }, { trackingId: id }],
        branch: {
          brand: {
            owner: { email: userEmail },
          },
        },
      },
      include: merchantOrderInclude(),
    });

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    return order;
  });

  server.get("/orders", async (request, reply) => {
    const userEmail = (request.user as any).email;
    const orders = await prisma.order.findMany({
      where: {
        branch: {
          brand: {
            owner: { email: userEmail }
          }
        }
      },
      include: {
        branch: true,
        zone: true,
        hero: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      take: 50
    });
    return orders;
  });

  server.post("/customers/location-request", async (request) => {
    const { branchId, customerPhone, customerName } = parseObjectBody<{
      branchId?: string;
      customerPhone?: string;
      customerName?: string;
    }>(request.body);
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    if (!branchId || !customerPhone) {
      throw new AppError(400, "LOCATION_REQUEST_FIELDS_REQUIRED", "branchId and customerPhone are required");
    }

    const branch = brand.branches.find((item: { id: string }) => item.id === branchId);
    if (!branch) {
      throw new AppError(400, "INVALID_BRANCH", "Invalid branchId for current merchant");
    }

    let locationRequest;
    try {
      locationRequest = await CustomerLocationRequestService.create({
        merchantId: brand.id,
        branchId: branch.id,
        customerPhone,
        customerName,
        requestedByEmail: userEmail,
        merchantName: brand.nameAr || brand.name,
        branchName: branch.nameAr || branch.name,
      });
    } catch (error) {
      await raiseOperationalAlert({
        dedupeKey: `whatsapp-location-request:${brand.id}:${customerPhone}`,
        kind: "WHATSAPP_LOCATION_REQUEST_FAILED",
        severity: "high",
        titleCode: "location_request.failed.title",
        messageCode: "location_request.failed.message",
        entityType: "MERCHANT",
        entityId: brand.id,
        actionHref: "/admin/customers",
        metadata: {
          merchantId: brand.id,
          merchantName: brand.nameAr || brand.name,
          branchId: branch.id,
          branchName: branch.nameAr || branch.name,
          customerPhone,
          requestedByEmail: userEmail,
        },
      });
      throw error;
    }

    if (!locationRequest) {
      throw new AppError(502, "LOCATION_REQUEST_CREATE_FAILED", "Could not create the customer location request");
    }

    server.broadcast(
      "MERCHANT_LOCATION_REQUEST_UPDATE",
      {
        phone: locationRequest?.customerPhone,
        request: locationRequest,
      },
      { channels: [`merchant-location-request:${locationRequest.customerPhone}`] },
    );

    return locationRequest;
  });

  server.get("/customers/:phone/location-request", async (request) => {
    const { phone } = request.params as { phone: string };
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    const requestState = await CustomerLocationRequestService.getLatestForMerchant(brand.id, phone);
    return requestState;
  });

  server.get("/customers", async (request) => {
    const { q } = request.query as { q?: string };
    const userEmail = (request.user as any).email;
    const role = (request.user as any).role;

    if (role === "BRANCH_MANAGER") {
      throw new AppError(403, "CUSTOMERS_SCOPE_DENIED", "Branch managers cannot manage merchant customers");
    }

    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    return listCustomersForMerchant(brand.id, q);
  });

  server.get("/customers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const userEmail = (request.user as any).email;
    const role = (request.user as any).role;

    if (role === "BRANCH_MANAGER") {
      throw new AppError(403, "CUSTOMERS_SCOPE_DENIED", "Branch managers cannot manage merchant customers");
    }

    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    return getCustomerDetailForMerchant(brand.id, id);
  });

  server.patch("/customers/:id", async (request) => {
    const { id } = request.params as { id: string };
    const userEmail = (request.user as any).email;
    const role = (request.user as any).role;

    if (role === "BRANCH_MANAGER") {
      throw new AppError(403, "CUSTOMERS_SCOPE_DENIED", "Branch managers cannot manage merchant customers");
    }

    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    return updateCustomerForMerchant(brand.id, id, parseObjectBody<any>(request.body));
  });

  server.get("/branches", async (request, reply) => {
    const userEmail = (request.user as any).email;
    const branches = await prisma.branch.findMany({
      where: {
        brand: {
          owner: { email: userEmail }
        }
      }
    });
    return branches;
  });

  server.get("/heroes", async (request, reply) => {
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    const assignments = await prisma.heroAssignment.findMany({
      where: {
        branch: {
          brandId: brand.id,
        },
        isActive: true,
      },
      include: {
        branch: true,
        hero: {
          include: {
            user: true,
            zone: true,
            orders: {
              where: {
                status: {
                  notIn: ["DELIVERED", "FAILED", "CANCELLED"],
                },
              },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      model: assignment.model,
      baseSalary: assignment.baseSalary,
      bonusPerOrder: assignment.bonusPerOrder,
      branch: {
        id: assignment.branch.id,
        name: assignment.branch.name,
        nameAr: assignment.branch.nameAr,
      },
      hero: {
        id: assignment.hero.id,
        name: assignment.hero.user.name,
        email: assignment.hero.user.email,
        phone: assignment.hero.user.phone,
        status: assignment.hero.status,
        efficiencyScore: assignment.hero.efficiencyScore,
        totalDeliveries: assignment.hero.totalDeliveries,
        ordersToday: assignment.hero.ordersToday,
        walletBalance: assignment.hero.walletBalance,
        activeOrders: assignment.hero.orders.length,
        zone: assignment.hero.zone
          ? {
              id: assignment.hero.zone.id,
              name: assignment.hero.zone.name,
              nameAr: assignment.hero.zone.nameAr,
            }
          : null,
      },
    }));
  });

  server.post("/branches", async (request, reply) => {
    const { name, nameAr, address, lat, lng, phone } = parseObjectBody<any>(request.body);
    const userEmail = (request.user as any).email;

    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lng !== "number" || !Number.isFinite(lng)) {
      throw new AppError(
        400,
        "BRANCH_LOCATION_REQUIRED",
        "Confirm the branch location on the map before saving the branch",
      );
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        nameAr,
        address,
        lat,
        lng,
        phone,
        brandId: brand.id
      }
    });

    return branch;
  });

  server.get("/branch/orders", async (request, reply) => {
    const userEmail = (request.user as any).email;
    const branch = await getCurrentManagedBranch(userEmail);

    if (!branch) {
      throw new AppError(404, "BRANCH_NOT_FOUND", "Managed branch not found");
    }

    const orders = await prisma.order.findMany({
      where: { branchId: branch.id },
      include: {
        zone: true,
        hero: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      take: 60,
    });

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        nameAr: branch.nameAr,
        brandName: branch.brand.nameAr || branch.brand.name,
      },
      orders,
    };
  });

  server.get("/invoices", async (request, reply) => {
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    const [activeContract, invoices, transactions] = await Promise.all([
      prisma.contract.findFirst({
        where: { brandId: brand.id, isActive: true },
        orderBy: { validFrom: "desc" },
      }),
      prisma.invoice.findMany({
        where: { brandId: brand.id },
        include: {
          lineItems: true,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.transaction.findMany({
        where: { merchantId: brand.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        nameAr: brand.nameAr,
        walletBalance: brand.walletBalance,
        isActive: brand.isActive,
      },
      contract: activeContract,
      invoices,
      transactions,
    };
  });

  server.get("/settings", async (request, reply) => {
    const userEmail = (request.user as any).email;
    const brand = await prisma.merchantBrand.findFirst({
      where: {
        owner: { email: userEmail },
      },
      include: {
        owner: true,
        branches: {
          orderBy: { createdAt: "asc" },
        },
        contracts: {
          where: { isActive: true },
          orderBy: { validFrom: "desc" },
          take: 1,
        },
      },
    });

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    return {
      brand: {
        id: brand.id,
        name: brand.name,
        nameAr: brand.nameAr,
        logoUrl: brand.logoUrl,
        walletBalance: brand.walletBalance,
        isActive: brand.isActive,
        createdAt: brand.createdAt,
      },
      owner: {
        id: brand.owner.id,
        name: brand.owner.name,
        email: brand.owner.email,
        phone: brand.owner.phone,
        language: brand.owner.language,
      },
      branches: brand.branches,
      contract: brand.contracts[0] || null,
    };
  });

  server.get("/customers/:phone/addresses", async (request, reply) => {
    const { phone } = request.params as any;
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    const addresses = await prisma.customerAddressVault.findMany({
      where: {
        phone,
        branch: {
          brandId: brand.id,
        },
      },
      orderBy: [
        { usageCount: "desc" },
        { lastUsedAt: "desc" },
      ],
    });
    return addresses;
  });

  server.get("/customers/:phone/context", async (request) => {
    const { phone } = request.params as { phone: string };
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    const [profile, addresses, recentOrders, locationRequest] = await Promise.all([
      prisma.customerProfile.findFirst({
        where: {
          phone,
          merchantId: brand.id,
        },
      }),
      prisma.customerAddressVault.findMany({
        where: {
          phone,
          branch: {
            brandId: brand.id,
          },
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
          branch: {
            brandId: brand.id,
          },
          customerPhone: phone,
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
        take: 5,
      }),
      CustomerLocationRequestService.getLatestForMerchant(brand.id, phone),
    ]);

    return {
      customer: {
        phone,
        name: profile?.name || addresses[0]?.name || null,
        totalOrders: profile?.totalOrders || recentOrders.length,
        lastAddress: profile?.lastAddress || addresses[0]?.addressLabel || null,
        lastOrderAt: recentOrders[0]?.requestedAt.toISOString() || null,
      },
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
      locationRequest,
    };
  });

  server.post("/address-candidates", async (request) => {
    const { branchId, query } = parseObjectBody<{
      branchId?: string;
      query?: string;
    }>(request.body);
    const userEmail = (request.user as any).email;
    const brand = await getCurrentMerchantBrand(userEmail);

    if (!brand) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant brand not found");
    }

    if (!branchId || !query?.trim()) {
      throw new AppError(400, "ADDRESS_QUERY_REQUIRED", "branchId and query are required");
    }

    const branch = brand.branches.find((item: { id: string }) => item.id === branchId);
    if (!branch) {
      throw new AppError(400, "INVALID_BRANCH", "Invalid branchId for current merchant");
    }

    const candidates = await GeocodingService.search({
      query,
      proximity: { lat: branch.lat, lng: branch.lng },
    });

    if (candidates.length) {
      return {
        candidates,
        degraded: false,
      };
    }

    await raiseOperationalAlert({
      dedupeKey: `geocode-fallback:${brand.id}:${branch.id}:${query.trim().toLowerCase()}`,
      kind: "GEOCODE_FALLBACK",
      severity: "medium",
      titleCode: "geocode.fallback.title",
      messageCode: "geocode.fallback.message",
      entityType: "BRANCH",
      entityId: branch.id,
      actionHref: `/admin/branches/${branch.id}`,
      metadata: {
        merchantId: brand.id,
        merchantName: brand.nameAr || brand.name,
        branchId: branch.id,
        branchName: branch.nameAr || branch.name,
        query: query.trim(),
      },
    });

    return {
      candidates: GeocodingService.fallbackFromBranch(query, branch),
      degraded: true,
    };
  });
}
