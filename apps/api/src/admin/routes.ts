import { FastifyInstance } from "fastify";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireRole } from "../decorators/auth";
import { prisma } from "../lib/prisma";
import {
  AdminPermissionScope,
  BloodType,
  ContractType,
  HeroStatus,
  HeroVerificationStatus,
  MerchantFinanceScenario,
  Prisma,
  SettlementCycle,
  StaffCompensationMode,
  StaffCompensationTarget,
  TransactionType,
  UserRole,
  VacationRequestStatus,
  VacationType,
} from "@tayyar/db";
import { getAdminOperationalAlerts, raiseOperationalAlert, resolveOperationalAlert } from "../services/operational-alerts";
import { AppError } from "../lib/errors";
import { listAuditEvents, recordAuditEvent } from "../services/audit-events";
import { AuthService } from "../services/auth";
import { env } from "../config";
import { NotificationService } from "../services/notifications";
import { buildAdminReportExport } from "../services/report-exports";
import { enqueueAssignmentJob } from "../workers/queues";
import { parseObjectBody } from "../lib/request-body";
import { assertHeroEligibleForOrder, listEligibleHeroesForOrder } from "../services/assignment-eligibility";
import {
  getCustomerDetailForAdmin,
  listCustomersForAdmin,
  updateCustomerForAdmin,
} from "../services/customer-management";
import {
  buildDateRangeFilter,
  buildMerchantFinanceSummary,
  coerceDateRange,
  listMerchantFinanceSummaries,
} from "../services/merchant-finance";
import { ALLOWED_DOCUMENT_MIME_TYPES, resolveUploadExtension, sanitizeUploadSegment } from "../lib/uploads";
import { normalizeAdminScopes, syncManagedHero, syncManagedUser } from "../services/admin-user-sync";
import {
  buildHeroCompensationSummary,
  decideHeroVacationRequest,
  getHeroHrDetailsByUserId,
  setHeroVacationAllowance,
} from "../services/staff-operations";

async function getEntityAlertFeed(entityType: string, entityId: string) {
  const alerts = await prisma.operationalAlert.findMany({
    where: {
      entityType,
      entityId,
      status: "OPEN",
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return alerts.map((alert) => ({
    id: alert.id,
    kind: alert.kind,
    severity: alert.severity,
    status: alert.status,
    titleCode: alert.titleCode,
    messageCode: alert.messageCode,
    actionHref: alert.actionHref,
    metadata: alert.metadata,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  }));
}

const MANUAL_ASSIGNABLE_ORDER_STATUSES = ["REQUESTED", "ASSIGNED", "HERO_ACCEPTED"] as const;

function normalizePhone(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }
  return value?.replace(/[^\d+]/g, "") || null;
}

function normalizeBloodType(value?: BloodType | string | null) {
  if (value === undefined) {
    return undefined;
  }
  if (!value) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  const aliases: Record<string, BloodType> = {
    A_POSITIVE: BloodType.A_POS,
    A_NEGATIVE: BloodType.A_NEG,
    B_POSITIVE: BloodType.B_POS,
    B_NEGATIVE: BloodType.B_NEG,
    AB_POSITIVE: BloodType.AB_POS,
    AB_NEGATIVE: BloodType.AB_NEG,
    O_POSITIVE: BloodType.O_POS,
    O_NEGATIVE: BloodType.O_NEG,
    A_POS: BloodType.A_POS,
    A_NEG: BloodType.A_NEG,
    B_POS: BloodType.B_POS,
    B_NEG: BloodType.B_NEG,
    AB_POS: BloodType.AB_POS,
    AB_NEG: BloodType.AB_NEG,
    O_POS: BloodType.O_POS,
    O_NEG: BloodType.O_NEG,
    UNKNOWN: BloodType.UNKNOWN,
  };

  if (!aliases[normalized]) {
    throw new AppError(400, "INVALID_BLOOD_TYPE", "Unsupported blood type value");
  }

  return aliases[normalized];
}

function deriveContractValue(input: {
  type?: ContractType;
  value?: number | null;
  retainerAmount?: number | null;
  perOrderFee?: number | null;
}) {
  if (typeof input.value === "number") {
    return input.value;
  }

  if (input.type === "PER_ORDER") {
    return input.perOrderFee ?? 0;
  }

  return input.retainerAmount ?? 0;
}

function contractTypeToScenario(type: ContractType) {
  if (
    type === ContractType.RETAINER_DAILY ||
    type === ContractType.RETAINER_WEEKLY ||
    type === ContractType.RETAINER_MONTHLY
  ) {
    return MerchantFinanceScenario.RETAINER;
  }
  return MerchantFinanceScenario.PER_ORDER;
}

function scenarioToLegacyContractType(
  scenario: MerchantFinanceScenario,
  settlementCycle: SettlementCycle | null | undefined,
) {
  if (scenario === MerchantFinanceScenario.RETAINER) {
    if (settlementCycle === SettlementCycle.MONTHLY) {
      return ContractType.RETAINER_MONTHLY;
    }
    return ContractType.RETAINER_WEEKLY;
  }

  return ContractType.PER_ORDER;
}

function buildHeroPayload(user: {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  heroProfile: null | {
    id: string;
    zoneId: string | null;
    status: string;
    totalDeliveries: number;
    currentLat: number | null;
    currentLng: number | null;
    licenseUrl: string | null;
    nationalId: string | null;
    nationalIdFrontUrl: string | null;
    nationalIdBackUrl: string | null;
    bloodType: BloodType;
    isVerified: boolean;
    verificationStatus: HeroVerificationStatus;
    verificationNote: string | null;
    zone: null | { id: string; name: string; nameAr: string | null };
    assignments: Array<{
      id: string;
      model: string;
      baseSalary: number | null;
      bonusPerOrder: number | null;
      branch: {
        id: string;
        name: string;
        nameAr: string | null;
        brand: {
          name: string;
          nameAr: string | null;
        };
      };
    }>;
  };
}) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    heroProfile: user.heroProfile
      ? {
          id: user.heroProfile.id,
          zoneId: user.heroProfile.zoneId,
          status: user.heroProfile.status,
          totalDeliveries: user.heroProfile.totalDeliveries,
          currentLat: user.heroProfile.currentLat,
          currentLng: user.heroProfile.currentLng,
          licenseUrl: user.heroProfile.licenseUrl,
          nationalId: user.heroProfile.nationalId,
          nationalIdFrontUrl: user.heroProfile.nationalIdFrontUrl,
          nationalIdBackUrl: user.heroProfile.nationalIdBackUrl,
          bloodType: user.heroProfile.bloodType,
          isVerified: user.heroProfile.isVerified,
          verificationStatus: user.heroProfile.verificationStatus,
          verificationNote: user.heroProfile.verificationNote,
          zone: user.heroProfile.zone
            ? {
                id: user.heroProfile.zone.id,
                name: user.heroProfile.zone.name,
                nameAr: user.heroProfile.zone.nameAr,
              }
            : null,
          assignments: user.heroProfile.assignments.map((assignment) => ({
            id: assignment.id,
            model: assignment.model,
            baseSalary: assignment.baseSalary,
            bonusPerOrder: assignment.bonusPerOrder,
            branch: {
              id: assignment.branch.id,
              name: assignment.branch.name,
              nameAr: assignment.branch.nameAr,
              merchantName: assignment.branch.brand.name,
              merchantNameAr: assignment.branch.brand.nameAr,
            },
          })),
        }
      : null,
  };
}

function buildAdminUserPayload(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  language: string;
  isActive: boolean;
  adminScopes?: AdminPermissionScope[] | null;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  heroProfile?: null | {
    id: string;
    status: HeroStatus;
    verificationStatus?: HeroVerificationStatus | null;
    zone?: { id: string; name: string; nameAr: string | null } | null;
    assignments: Array<{
      id: string;
      model: string;
      branch: {
        id: string;
        name: string;
        nameAr: string | null;
        brand: {
          name: string;
          nameAr: string | null;
        };
      };
    }>;
  };
  merchantOwnership?: { id: string; name: string; nameAr: string | null } | null;
  branchManagement?: Array<{
    id: string;
    name: string;
    nameAr: string | null;
    brand: { name: string; nameAr: string | null };
  }>;
  supervisorZones?: Array<{
    zone: { id: string; name: string; nameAr: string | null };
  }>;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    language: user.language,
    isActive: user.isActive,
    adminScopes: user.adminScopes || [],
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    heroProfile: user.heroProfile
      ? {
          id: user.heroProfile.id,
          status: user.heroProfile.status,
          verificationStatus: user.heroProfile.verificationStatus || null,
          zone: user.heroProfile.zone
            ? {
                id: user.heroProfile.zone.id,
                name: user.heroProfile.zone.name,
                nameAr: user.heroProfile.zone.nameAr,
              }
            : null,
          assignments: user.heroProfile.assignments.map((assignment) => ({
            id: assignment.id,
            model: assignment.model,
            branch: {
              id: assignment.branch.id,
              name: assignment.branch.name,
              nameAr: assignment.branch.nameAr,
              merchantName: assignment.branch.brand.nameAr || assignment.branch.brand.name,
            },
          })),
        }
      : null,
    merchantOwnership: user.merchantOwnership
      ? {
          id: user.merchantOwnership.id,
          name: user.merchantOwnership.name,
          nameAr: user.merchantOwnership.nameAr,
        }
      : null,
    branchManagement: (user.branchManagement || []).map((branch) => ({
      id: branch.id,
      name: branch.name,
      nameAr: branch.nameAr,
      merchantName: branch.brand.nameAr || branch.brand.name,
    })),
    supervisorZones: (user.supervisorZones || []).map((assignment) => ({
      id: assignment.zone.id,
      name: assignment.zone.name,
      nameAr: assignment.zone.nameAr,
    })),
  };
}

async function issueActivationIfNeeded(user: {
  id: string;
  email: string;
  isActive: boolean;
}) {
  if (user.isActive) {
    return null;
  }

  const activation = await AuthService.resendActivation(user.email);
  return activation.activationUrl || null;
}

function normalizeIdArray(input?: unknown) {
  if (!Array.isArray(input)) {
    return undefined;
  }

  return Array.from(
    new Set(
      input
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

async function loadAdminUserForPayload(tx: Prisma.TransactionClient | typeof prisma, id: string) {
  return tx.user.findUniqueOrThrow({
    where: { id },
    include: {
      heroProfile: {
        include: {
          zone: true,
          assignments: {
            where: { isActive: true },
            include: { branch: { include: { brand: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      merchantOwnership: true,
      branchManagement: {
        include: { brand: true },
      },
      supervisorZones: {
        include: { zone: true },
        orderBy: { assignedAt: "desc" },
      },
    },
  });
}

async function applyRoleAssignments(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    role: UserRole;
    supervisorZoneIds?: string[];
    branchId?: string | null;
  },
) {
  if (params.role === UserRole.SUPERVISOR) {
    if (params.supervisorZoneIds !== undefined) {
      await tx.supervisorZone.deleteMany({ where: { supervisorId: params.userId } });
      if (params.supervisorZoneIds.length) {
        await tx.supervisorZone.createMany({
          data: params.supervisorZoneIds.map((zoneId) => ({
            supervisorId: params.userId,
            zoneId,
          })),
          skipDuplicates: true,
        });
      }
    }
  } else {
    await tx.supervisorZone.deleteMany({ where: { supervisorId: params.userId } });
  }

  if (params.role === UserRole.BRANCH_MANAGER) {
    if (params.branchId !== undefined) {
      await tx.branch.updateMany({
        where: { managerId: params.userId },
        data: { managerId: null },
      });

      if (params.branchId) {
        await tx.branch.update({
          where: { id: params.branchId },
          data: { managerId: params.userId },
        });
      }
    }
  } else {
    await tx.branch.updateMany({
      where: { managerId: params.userId },
      data: { managerId: null },
    });
  }
}

async function unassignActiveOrdersForHero(
  tx: Prisma.TransactionClient,
  heroId: string,
  actorUserId?: string,
  note = "Hero account deactivated by admin",
) {
  const activeOrders = await tx.order.findMany({
    where: {
      heroId,
      status: {
        in: ["ASSIGNED", "HERO_ACCEPTED", "PICKED_UP", "ON_WAY", "IN_TRANSIT", "ARRIVED"],
      },
    },
    select: { id: true, orderNumber: true, trackingId: true, status: true },
  });

  for (const order of activeOrders) {
    await tx.order.update({
      where: { id: order.id },
      data: {
        heroId: null,
        status: "REQUESTED",
        assignedAt: null,
        statusHistory: {
          create: {
            status: "REQUESTED",
            changedBy: actorUserId,
            note,
          },
        },
      },
    });
  }

  return activeOrders;
}

async function upsertHeroAssignmentAndCompensation(params: {
  tx: Prisma.TransactionClient | typeof prisma;
  heroProfileId: string;
  userId: string;
  branchId: string;
  model: "DEDICATED" | "POOL";
  baseSalary?: number | null;
  bonusPerOrder?: number | null;
}) {
  const { tx, heroProfileId, userId, branchId, model, baseSalary, bonusPerOrder } = params;

  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    include: { brand: true },
  });

  if (!branch) {
    throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
  }
  if (!branch.isActive || !branch.brand.isActive) {
    throw new AppError(409, "BRANCH_INACTIVE", "Inactive branches cannot receive hero assignments");
  }

  if (model === "DEDICATED") {
    await tx.heroAssignment.updateMany({
      where: {
        heroId: heroProfileId,
        isActive: true,
        model: "DEDICATED",
        NOT: { branchId },
      },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });
  }

  const existingAssignment = await tx.heroAssignment.findFirst({
    where: {
      heroId: heroProfileId,
      branchId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const assignment =
    existingAssignment
      ? await tx.heroAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            model,
            baseSalary: typeof baseSalary === "number" ? baseSalary : existingAssignment.baseSalary,
            bonusPerOrder:
              typeof bonusPerOrder === "number" ? bonusPerOrder : existingAssignment.bonusPerOrder,
            isActive: true,
            endDate: null,
          },
        })
      : await tx.heroAssignment.create({
          data: {
            heroId: heroProfileId,
            branchId,
            model,
            startDate: new Date(),
            baseSalary: typeof baseSalary === "number" ? baseSalary : null,
            bonusPerOrder: typeof bonusPerOrder === "number" ? bonusPerOrder : null,
          },
        });

  await tx.staffCompensationProfile.upsert({
    where: { userId },
    create: {
      userId,
      branchId: branch.id,
      target: StaffCompensationTarget.HERO,
      mode: branch.defaultHeroCompensationMode || StaffCompensationMode.COMMISSION_ONLY,
      baseSalary: typeof baseSalary === "number" ? baseSalary : branch.defaultHeroBaseSalary || 0,
      commissionPerOrder:
        typeof bonusPerOrder === "number" ? bonusPerOrder : branch.defaultHeroCommissionPerOrder || 0,
      isActive: true,
      notes: `Linked to ${model.toLowerCase()} assignment at ${branch.name}`,
    },
    update: {
      branchId: branch.id,
      target: StaffCompensationTarget.HERO,
      mode: branch.defaultHeroCompensationMode || StaffCompensationMode.COMMISSION_ONLY,
      baseSalary: typeof baseSalary === "number" ? baseSalary : branch.defaultHeroBaseSalary || 0,
      commissionPerOrder:
        typeof bonusPerOrder === "number" ? bonusPerOrder : branch.defaultHeroCommissionPerOrder || 0,
      isActive: true,
      effectiveTo: null,
      notes: `Linked to ${model.toLowerCase()} assignment at ${branch.name}`,
    },
  });

  return assignment;
}

async function releaseHeroIfIdle(heroId: string) {
  const activeOrders = await prisma.order.count({
    where: {
      heroId,
      status: {
        in: ["ASSIGNED", "HERO_ACCEPTED", "PICKED_UP", "ON_WAY", "IN_TRANSIT", "ARRIVED"],
      },
    },
  });

  if (activeOrders === 0) {
    await prisma.heroProfile.update({
      where: { id: heroId },
      data: { status: "ONLINE" },
    });
  }
}

async function getMerchantDetailPayload(id: string) {
  const merchant = await prisma.merchantBrand.findUnique({
    where: { id },
    include: {
      owner: true,
      branches: {
        include: {
          _count: {
            select: {
              orders: true,
              customers: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!merchant) {
    throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant not found");
  }

  const branchIds = merchant.branches.map((branch) => branch.id);
  const [orderCount, recentOrders, alerts, auditTrail] = await Promise.all([
    branchIds.length
      ? prisma.order.count({
          where: {
            branchId: { in: branchIds },
          },
        })
      : Promise.resolve(0),
    branchIds.length
      ? prisma.order.findMany({
          where: {
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
          orderBy: { requestedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    getEntityAlertFeed("MERCHANT", merchant.id),
    listAuditEvents("MERCHANT", merchant.id, 12),
  ]);

  return {
    id: merchant.id,
    name: merchant.name,
    nameAr: merchant.nameAr,
    logoUrl: merchant.logoUrl,
    walletBalance: merchant.walletBalance,
    isActive: merchant.isActive,
    createdAt: merchant.createdAt.toISOString(),
    updatedAt: merchant.updatedAt.toISOString(),
    owner: {
      id: merchant.owner.id,
      name: merchant.owner.name,
      email: merchant.owner.email,
      phone: merchant.owner.phone,
      language: merchant.owner.language,
    },
    stats: {
      branches: merchant.branches.length,
      customers: merchant.branches.reduce((sum, branch) => sum + branch._count.customers, 0),
      orders: orderCount,
      activeBranches: merchant.branches.filter((branch) => branch.isActive).length,
    },
    alerts,
    auditTrail,
    branches: merchant.branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      nameAr: branch.nameAr,
      address: branch.address,
      phone: branch.phone,
      whatsappNumber: branch.whatsappNumber,
      isActive: branch.isActive,
      orderCount: branch._count.orders,
      customerCount: branch._count.customers,
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

async function getBranchDetailPayload(id: string) {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      brand: true,
      manager: true,
      _count: {
        select: {
          orders: true,
          customers: true,
          heroAssignments: {
            where: { isActive: true },
          },
        },
      },
      orders: {
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
      },
    },
  });

  if (!branch) {
    throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
  }

  const [alerts, auditTrail] = await Promise.all([
    getEntityAlertFeed("BRANCH", branch.id),
    listAuditEvents("BRANCH", branch.id, 12),
  ]);

  return {
    id: branch.id,
    name: branch.name,
    nameAr: branch.nameAr,
    address: branch.address,
    lat: branch.lat,
    lng: branch.lng,
    phone: branch.phone,
    whatsappNumber: branch.whatsappNumber,
    isActive: branch.isActive,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
    merchant: {
      id: branch.brand.id,
      name: branch.brand.name,
      nameAr: branch.brand.nameAr,
    },
    manager: branch.manager
      ? {
          id: branch.manager.id,
          name: branch.manager.name,
          email: branch.manager.email,
          phone: branch.manager.phone,
        }
      : null,
    stats: {
      orders: branch._count.orders,
      customers: branch._count.customers,
      activeHeroAssignments: branch._count.heroAssignments,
    },
    alerts,
    auditTrail,
    recentOrders: branch.orders.map((order) => ({
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

export default async function adminRoutes(server: FastifyInstance) {
  // Add auth hooks for all routes in this plugin
  server.addHook("onRequest", requireRole(["ADMIN"]));

  server.post("/uploads", async (request) => {
    const actor = request.user as { id?: string; email?: string };
    let upload: Awaited<ReturnType<typeof request.file>> | null = null;
    let category = "admin";
    let documentType = "document";
    let entityId = "draft";

    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (upload) {
          await part.toBuffer();
          throw new AppError(400, "MULTIPLE_UPLOADS_NOT_SUPPORTED", "Only one file can be uploaded at a time");
        }
        upload = part;
        continue;
      }

      if (typeof part.value !== "string") {
        continue;
      }

      if (part.fieldname === "category") {
        category = sanitizeUploadSegment(part.value) || "admin";
      } else if (part.fieldname === "documentType") {
        documentType = sanitizeUploadSegment(part.value) || "document";
      } else if (part.fieldname === "entityId") {
        entityId = sanitizeUploadSegment(part.value) || "draft";
      }
    }

    if (!upload) {
      throw new AppError(400, "UPLOAD_REQUIRED", "A file is required");
    }

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(upload.mimetype.toLowerCase())) {
      throw new AppError(400, "UNSUPPORTED_UPLOAD_TYPE", "Unsupported upload type");
    }

    const extension = resolveUploadExtension(upload.filename, upload.mimetype);
    const relativeDirectory = path.join(category, entityId, documentType);
    const diskDirectory = path.join(env.UPLOADS_DIR, relativeDirectory);
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const diskPath = path.join(diskDirectory, fileName);

    await mkdir(diskDirectory, { recursive: true });
    const buffer = await upload.toBuffer();
    await writeFile(diskPath, buffer);

    const relativeUrl = `/uploads/${relativeDirectory.split(path.sep).join("/")}/${fileName}`;

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "ADMIN_UPLOAD_CREATED",
      entityType: "FILE",
      entityId: `${category}:${entityId}:${fileName}`,
      summary: {
        category,
        documentType,
        entityId,
        originalName: upload.filename,
        mimeType: upload.mimetype,
        size: buffer.length,
      },
      after: { url: relativeUrl },
    });

    return {
      url: relativeUrl,
      name: upload.filename,
      mimeType: upload.mimetype,
      size: buffer.length,
    };
  });

  server.get("/dashboard/stats", async (request, reply) => {
    const [heroCount, orderCount, revenue, activeZones] = await Promise.all([
      prisma.heroProfile.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { deliveryFee: true }
      }),
      prisma.zone.count({
        where: { isActive: true },
      }),
    ]);

    return { 
      activeHeroes: heroCount, 
      totalOrders: orderCount, 
      totalRevenue: revenue._sum.deliveryFee || 0,
      activeZones,
    };
  });

  server.get("/users", async (request) => {
    const { q, role, status } = request.query as { q?: string; role?: UserRole | "ALL"; status?: "ACTIVE" | "INACTIVE" | "ALL" };

    const users = await prisma.user.findMany({
      where: {
        role: role && role !== "ALL" ? role : undefined,
        isActive: status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined,
        OR: q?.trim()
          ? [
              { name: { contains: q.trim(), mode: "insensitive" } },
              { email: { contains: q.trim(), mode: "insensitive" } },
              { phone: { contains: q.trim(), mode: "insensitive" } },
            ]
          : undefined,
      },
      include: {
        heroProfile: {
          include: {
            zone: true,
            assignments: {
              where: { isActive: true },
              include: { branch: { include: { brand: true } } },
              orderBy: { createdAt: "desc" },
            },
          },
        },
        merchantOwnership: true,
        branchManagement: {
          include: { brand: true },
        },
        supervisorZones: {
          include: { zone: true },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    });

    return users.map(buildAdminUserPayload);
  });

  server.post("/users", async (request) => {
    const actor = request.user as { id?: string; email?: string };
    const {
      name,
      email,
      phone,
      role,
      language,
      password,
      isActive,
      adminScopes,
      zoneId,
      status,
      verificationStatus,
      branchId,
      assignmentModel,
      baseSalary,
      bonusPerOrder,
      supervisorZoneIds,
    } = parseObjectBody<{
      name?: string;
      email?: string;
      phone?: string | null;
      role?: UserRole;
      language?: string;
      password?: string;
      isActive?: boolean;
      adminScopes?: AdminPermissionScope[];
      zoneId?: string | null;
      status?: HeroStatus | string | null;
      verificationStatus?: HeroVerificationStatus | null;
      branchId?: string | null;
      assignmentModel?: "DEDICATED" | "POOL" | null;
      baseSalary?: number | null;
      bonusPerOrder?: number | null;
      supervisorZoneIds?: string[];
    }>(request.body);

    if (!name || !email || !role) {
      throw new AppError(400, "USER_FIELDS_REQUIRED", "name, email, and role are required");
    }

    if (role === UserRole.HERO) {
      const user = await prisma.$transaction(async (tx) => {
        const nextHero = await syncManagedHero(tx, {
          role: UserRole.HERO,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone,
          language,
          password,
          isActive: isActive ?? Boolean(password),
          zoneId: zoneId || null,
          status: (status as HeroStatus | undefined) || HeroStatus.ONLINE,
          verificationStatus: verificationStatus || HeroVerificationStatus.APPROVED,
        });

        if (branchId && nextHero.heroProfile) {
          await upsertHeroAssignmentAndCompensation({
            tx,
            heroProfileId: nextHero.heroProfile.id,
            userId: nextHero.id,
            branchId,
            model: assignmentModel || "POOL",
            baseSalary: typeof baseSalary === "number" ? baseSalary : null,
            bonusPerOrder: typeof bonusPerOrder === "number" ? bonusPerOrder : null,
          });
        }

        return loadAdminUserForPayload(tx, nextHero.id);
      });
      const activationUrl = await issueActivationIfNeeded(user);

      await recordAuditEvent({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: user.id,
        summary: { role: user.role, email: user.email },
        after: { id: user.id, role: user.role, email: user.email, isActive: user.isActive },
      });

      return {
        ...buildAdminUserPayload(user),
        activationUrl,
      };
    }

    const { user, activationUrl } = await prisma.$transaction(async (tx) => {
      const created = await syncManagedUser(tx, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizePhone(phone),
        role,
        adminScopes: normalizeAdminScopes(adminScopes),
        language,
        password,
        isActive: isActive ?? Boolean(password),
      });

      await applyRoleAssignments(tx, {
        userId: created.id,
        role,
        supervisorZoneIds: normalizeIdArray(supervisorZoneIds),
        branchId: branchId || null,
      });

      return {
        user: await loadAdminUserForPayload(tx, created.id),
        activationUrl: null,
      };
    });

    const resolvedActivationUrl = activationUrl || (await issueActivationIfNeeded(user));

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: user.id,
      summary: { role: user.role, email: user.email },
      after: { id: user.id, role: user.role, email: user.email, isActive: user.isActive },
    });

    return {
      ...buildAdminUserPayload(user),
      activationUrl: resolvedActivationUrl,
    };
  });

  server.patch("/users/:id", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const {
      name,
      email,
      phone,
      role,
      language,
      isActive,
      password,
      adminScopes,
      zoneId,
      status,
      verificationStatus,
      branchId,
      assignmentModel,
      baseSalary,
      bonusPerOrder,
      supervisorZoneIds,
    } = parseObjectBody<{
      name?: string;
      email?: string;
      phone?: string | null;
      role?: UserRole;
      language?: string;
      isActive?: boolean;
      password?: string;
      adminScopes?: AdminPermissionScope[];
      zoneId?: string | null;
      status?: HeroStatus | string | null;
      verificationStatus?: HeroVerificationStatus | null;
      branchId?: string | null;
      assignmentModel?: "DEDICATED" | "POOL" | null;
      baseSalary?: number | null;
      bonusPerOrder?: number | null;
      supervisorZoneIds?: string[];
    }>(request.body);

    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        heroProfile: true,
        merchantOwnership: true,
        branchManagement: {
          include: { brand: true },
        },
      },
    });
    if (!existing) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    const nextRole = role || existing.role;

    if (nextRole === UserRole.HERO) {
      const updatedHero = await prisma.$transaction(async (tx) => {
        const nextHero = await syncManagedHero(tx, {
          existingUserId: id,
          role: UserRole.HERO,
          name: name?.trim() || existing.name,
          email: email?.trim().toLowerCase() || existing.email,
          phone: phone === undefined ? existing.phone : phone,
          language: language || existing.language,
          password,
          isActive: isActive ?? existing.isActive,
          avatarUrl: existing.avatarUrl,
          zoneId: zoneId === undefined ? existing.heroProfile?.zoneId || null : zoneId || null,
          status: (status as HeroStatus | undefined) || existing.heroProfile?.status || HeroStatus.ONLINE,
          nationalId: existing.heroProfile?.nationalId || null,
          nationalIdFrontUrl: existing.heroProfile?.nationalIdFrontUrl || null,
          nationalIdBackUrl: existing.heroProfile?.nationalIdBackUrl || null,
          licenseUrl: existing.heroProfile?.licenseUrl || null,
          bloodType: existing.heroProfile?.bloodType || BloodType.UNKNOWN,
          verificationStatus:
            verificationStatus || existing.heroProfile?.verificationStatus || HeroVerificationStatus.APPROVED,
          verificationNote: existing.heroProfile?.verificationNote || null,
        });

        if (branchId && nextHero.heroProfile) {
          await upsertHeroAssignmentAndCompensation({
            tx,
            heroProfileId: nextHero.heroProfile.id,
            userId: nextHero.id,
            branchId,
            model: assignmentModel || "POOL",
            baseSalary: typeof baseSalary === "number" ? baseSalary : null,
            bonusPerOrder: typeof bonusPerOrder === "number" ? bonusPerOrder : null,
          });
        }

        await applyRoleAssignments(tx, {
          userId: nextHero.id,
          role: UserRole.HERO,
          supervisorZoneIds: [],
          branchId: undefined,
        });

        const activeChangedToInactive = isActive === false && existing.isActive;
        if (activeChangedToInactive && nextHero.heroProfile) {
          await unassignActiveOrdersForHero(
            tx,
            nextHero.heroProfile.id,
            actor.id,
            "Hero user deactivated by admin",
          );
        }

        return loadAdminUserForPayload(tx, nextHero.id);
      });

      await recordAuditEvent({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: id,
        summary: { roleChanged: role && role !== existing.role ? role : undefined, toggledActive: isActive },
        before: {
          name: existing.name,
          email: existing.email,
          phone: existing.phone,
          role: existing.role,
          isActive: existing.isActive,
        },
        after: {
          name: updatedHero.name,
          email: updatedHero.email,
          phone: updatedHero.phone,
          role: updatedHero.role,
          isActive: updatedHero.isActive,
        },
      });

      return buildAdminUserPayload({
        ...updatedHero,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextUser = await syncManagedUser(tx, {
        existingUserId: id,
        name: name?.trim() || existing.name,
        email: email?.trim().toLowerCase() || existing.email,
        phone: phone === undefined ? existing.phone : phone,
        role: nextRole,
        language: language || existing.language,
        password,
        isActive: isActive ?? existing.isActive,
        avatarUrl: existing.avatarUrl,
        adminScopes: normalizeAdminScopes(adminScopes !== undefined ? adminScopes : existing.adminScopes),
      });

      if (existing.heroProfile) {
        await unassignActiveOrdersForHero(
          tx,
          existing.heroProfile.id,
          actor.id,
          "Hero role removed by admin",
        );
        await tx.heroAssignment.updateMany({
          where: { heroId: existing.heroProfile.id, isActive: true },
          data: {
            isActive: false,
            endDate: new Date(),
          },
        });
        await tx.heroProfile.update({
          where: { id: existing.heroProfile.id },
          data: { status: HeroStatus.OFFLINE },
        });
      }

        await applyRoleAssignments(tx, {
          userId: nextUser.id,
          role: nextRole,
          supervisorZoneIds: normalizeIdArray(supervisorZoneIds),
          branchId: branchId === undefined ? undefined : branchId || null,
        });

        return loadAdminUserForPayload(tx, nextUser.id);
      });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "USER_UPDATED",
      entityType: "USER",
      entityId: id,
      summary: { roleChanged: role && role !== existing.role ? role : undefined, toggledActive: isActive },
      before: {
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        role: existing.role,
        isActive: existing.isActive,
      },
      after: {
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        role: updated.role,
        isActive: updated.isActive,
      },
    });

    return buildAdminUserPayload(updated);
  });

  server.get("/heroes", async (request, reply) => {
    const heroes = await prisma.user.findMany({
      where: { role: UserRole.HERO },
      include: {
        heroProfile: {
          include: {
            zone: true,
            assignments: {
              where: { isActive: true },
              include: {
                branch: {
                  include: { brand: true },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return heroes.map(buildHeroPayload);
  });

  server.post("/heroes", async (request, reply) => {
    const actor = request.user as { id?: string; email?: string };
    const {
      name,
      phone,
      email,
      zoneId,
      status,
      isActive,
      avatarUrl,
      nationalId,
      nationalIdFrontUrl,
      nationalIdBackUrl,
      licenseUrl,
      bloodType,
      verificationStatus,
      verificationNote,
      branchId,
      assignmentModel,
      baseSalary,
      bonusPerOrder,
    } = parseObjectBody<{
      name?: string;
      phone?: string | null;
      email?: string;
      zoneId?: string | null;
      status?: string;
      isActive?: boolean;
      avatarUrl?: string | null;
      nationalId?: string | null;
      nationalIdFrontUrl?: string | null;
      nationalIdBackUrl?: string | null;
      licenseUrl?: string | null;
      bloodType?: BloodType | string | null;
      verificationStatus?: HeroVerificationStatus | null;
      verificationNote?: string | null;
      branchId?: string | null;
      assignmentModel?: "DEDICATED" | "POOL" | null;
      baseSalary?: number | null;
      bonusPerOrder?: number | null;
    }>(request.body);

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      throw new AppError(400, "HERO_FIELDS_REQUIRED", "name, email, and phone are required");
    }

    const resolvedVerificationStatus = verificationStatus || HeroVerificationStatus.PENDING;
    const resolvedBloodType = normalizeBloodType(bloodType) || BloodType.UNKNOWN;
    
    const user = await prisma.$transaction(async (tx) => {
      const createdHero = await syncManagedHero(tx, {
        role: UserRole.HERO,
        name: name.trim(),
        phone,
        email: email.trim().toLowerCase(),
        avatarUrl: avatarUrl?.trim() || null,
        isActive: isActive ?? true,
        zoneId,
        status: (status as HeroStatus | undefined) || HeroStatus.OFFLINE,
        nationalId: nationalId?.trim() || null,
        nationalIdFrontUrl: nationalIdFrontUrl?.trim() || null,
        nationalIdBackUrl: nationalIdBackUrl?.trim() || null,
        licenseUrl: licenseUrl?.trim() || null,
        bloodType: resolvedBloodType,
        verificationStatus: resolvedVerificationStatus,
        verificationNote: verificationNote?.trim() || null,
      });

      if (branchId && createdHero.heroProfile) {
        await upsertHeroAssignmentAndCompensation({
          tx,
          heroProfileId: createdHero.heroProfile.id,
          userId: createdHero.id,
          branchId,
          model: assignmentModel || "POOL",
          baseSalary: typeof baseSalary === "number" ? baseSalary : null,
          bonusPerOrder: typeof bonusPerOrder === "number" ? bonusPerOrder : null,
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: createdHero.id },
        include: {
          heroProfile: {
            include: {
              zone: true,
              assignments: {
                where: { isActive: true },
                include: {
                  branch: {
                    include: { brand: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "HERO_CREATED",
      entityType: "USER",
      entityId: user.id,
      summary: { zoneId, email: user.email, verificationStatus: resolvedVerificationStatus },
      after: { id: user.id, heroProfileId: user.heroProfile?.id },
    });

    return buildHeroPayload(user);
  });

  server.patch("/heroes/:id", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const {
      name,
      phone,
      email,
      zoneId,
      status,
      isActive,
      avatarUrl,
      nationalId,
      nationalIdFrontUrl,
      nationalIdBackUrl,
      licenseUrl,
      bloodType,
      verificationStatus,
      verificationNote,
      branchId,
      assignmentModel,
      baseSalary,
      bonusPerOrder,
    } = parseObjectBody<{
      name?: string;
      phone?: string | null;
      email?: string;
      zoneId?: string | null;
      status?: string;
      isActive?: boolean;
      avatarUrl?: string | null;
      nationalId?: string | null;
      nationalIdFrontUrl?: string | null;
      nationalIdBackUrl?: string | null;
      licenseUrl?: string | null;
      bloodType?: BloodType | string | null;
      verificationStatus?: HeroVerificationStatus | null;
      verificationNote?: string | null;
      branchId?: string | null;
      assignmentModel?: "DEDICATED" | "POOL" | null;
      baseSalary?: number | null;
      bonusPerOrder?: number | null;
    }>(request.body);

    const heroUser = await prisma.user.findFirst({
      where: { id, role: UserRole.HERO },
      include: { heroProfile: true },
    });

    if (!heroUser || !heroUser.heroProfile) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero not found");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextHero = await syncManagedHero(tx, {
        existingUserId: id,
        role: UserRole.HERO,
        name: name?.trim() || heroUser.name,
        email: email?.trim().toLowerCase() || heroUser.email,
        phone: phone === undefined ? heroUser.phone : phone,
        isActive: isActive ?? heroUser.isActive,
        avatarUrl: avatarUrl === undefined ? heroUser.avatarUrl : avatarUrl?.trim() || null,
        zoneId: zoneId === undefined ? heroUser.heroProfile!.zoneId : zoneId || null,
        status: (status as HeroStatus | undefined) || heroUser.heroProfile!.status,
        nationalId:
          nationalId === undefined ? heroUser.heroProfile!.nationalId : nationalId?.trim() || null,
        nationalIdFrontUrl:
          nationalIdFrontUrl === undefined
            ? heroUser.heroProfile!.nationalIdFrontUrl
            : nationalIdFrontUrl?.trim() || null,
        nationalIdBackUrl:
          nationalIdBackUrl === undefined
            ? heroUser.heroProfile!.nationalIdBackUrl
            : nationalIdBackUrl?.trim() || null,
        licenseUrl:
          licenseUrl === undefined ? heroUser.heroProfile!.licenseUrl : licenseUrl?.trim() || null,
        bloodType: normalizeBloodType(bloodType) || heroUser.heroProfile!.bloodType,
        verificationStatus: verificationStatus || heroUser.heroProfile!.verificationStatus,
        verificationNote:
          verificationNote === undefined
            ? heroUser.heroProfile!.verificationNote
            : verificationNote?.trim() || null,
      });

      if (branchId && nextHero.heroProfile) {
        await upsertHeroAssignmentAndCompensation({
          tx,
          heroProfileId: nextHero.heroProfile.id,
          userId: nextHero.id,
          branchId,
          model: assignmentModel || "POOL",
          baseSalary: typeof baseSalary === "number" ? baseSalary : null,
          bonusPerOrder: typeof bonusPerOrder === "number" ? bonusPerOrder : null,
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: nextHero.id },
        include: {
          heroProfile: {
            include: {
              zone: true,
              assignments: {
                where: { isActive: true },
                include: { branch: { include: { brand: true } } },
              },
            },
          },
        },
      });
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "HERO_UPDATED",
      entityType: "USER",
      entityId: id,
      summary: { zoneId, status, isActive, verificationStatus },
      before: {
        zoneId: heroUser.heroProfile.zoneId,
        status: heroUser.heroProfile.status,
        isActive: heroUser.isActive,
        verificationStatus: heroUser.heroProfile.verificationStatus,
      },
      after: {
        zoneId: updated.heroProfile?.zoneId || null,
        status: updated.heroProfile?.status || HeroStatus.OFFLINE,
        isActive: updated.isActive,
        verificationStatus: updated.heroProfile?.verificationStatus || HeroVerificationStatus.PENDING,
      },
    });

    return buildHeroPayload(updated);
  });

  server.patch("/heroes/:id/archive", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { archived } = parseObjectBody<{ archived?: boolean }>(request.body);

    const heroUser = await prisma.user.findFirst({
      where: { id, role: UserRole.HERO },
      include: { heroProfile: true },
    });

    if (!heroUser || !heroUser.heroProfile) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero not found");
    }

    const nextActive = archived === true ? false : true;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        isActive: nextActive,
      },
      include: {
        heroProfile: {
          include: {
            zone: true,
            assignments: {
              where: { isActive: true },
              include: {
                branch: {
                  include: { brand: true },
                },
              },
            },
          },
        },
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: nextActive ? "HERO_RESTORED" : "HERO_ARCHIVED",
      entityType: "USER",
      entityId: id,
      before: { isActive: heroUser.isActive },
      after: { isActive: updated.isActive },
    });

    return buildHeroPayload(updated);
  });

  server.post("/heroes/:id/assignments", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { branchId, model, baseSalary, bonusPerOrder } = parseObjectBody<{
      branchId?: string;
      model?: "DEDICATED" | "POOL";
      baseSalary?: number | null;
      bonusPerOrder?: number | null;
    }>(request.body);

    if (!branchId || !model) {
      throw new AppError(400, "ASSIGNMENT_FIELDS_REQUIRED", "branchId and model are required");
    }

    const hero = await prisma.heroProfile.findUnique({ where: { id } });
    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero not found");
    }
    if (!hero.isVerified || hero.verificationStatus !== HeroVerificationStatus.APPROVED) {
      throw new AppError(409, "HERO_NOT_VERIFIED", "Only approved heroes can receive assignments");
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { brand: true },
    });
    if (!branch) {
      throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
    }
    if (!branch.isActive || !branch.brand.isActive) {
      throw new AppError(409, "BRANCH_INACTIVE", "Inactive branches cannot receive hero assignments");
    }

    if (model === "DEDICATED") {
      await prisma.heroAssignment.updateMany({
        where: {
          heroId: id,
          branchId,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });
    }

    const assignment = await prisma.heroAssignment.create({
      data: {
        heroId: id,
        branchId,
        model,
        startDate: new Date(),
        baseSalary: typeof baseSalary === "number" ? baseSalary : null,
        bonusPerOrder: typeof bonusPerOrder === "number" ? bonusPerOrder : null,
      },
      include: {
        branch: {
          include: { brand: true },
        },
        hero: {
          include: { user: true, zone: true },
        },
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "HERO_ASSIGNMENT_CREATED",
      entityType: "HERO_ASSIGNMENT",
      entityId: assignment.id,
      summary: {
        heroId: id,
        branchId,
        model,
      },
      after: {
        assignmentId: assignment.id,
        heroId: id,
        branchId,
        model,
      },
    });

    return assignment;
  });

  server.patch("/hero-assignments/:id", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { isActive, endDate, baseSalary, bonusPerOrder } = parseObjectBody<{
      isActive?: boolean;
      endDate?: string | null;
      baseSalary?: number | null;
      bonusPerOrder?: number | null;
    }>(request.body);

    const existing = await prisma.heroAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
    }

    const updated = await prisma.heroAssignment.update({
      where: { id },
      data: {
        isActive,
        endDate: endDate === undefined ? undefined : endDate ? new Date(endDate) : new Date(),
        baseSalary: baseSalary === undefined ? undefined : baseSalary,
        bonusPerOrder: bonusPerOrder === undefined ? undefined : bonusPerOrder,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: updated.isActive ? "HERO_ASSIGNMENT_UPDATED" : "HERO_ASSIGNMENT_PAUSED",
      entityType: "HERO_ASSIGNMENT",
      entityId: id,
      summary: { isActive: updated.isActive },
      before: { isActive: existing.isActive, endDate: existing.endDate },
      after: { isActive: updated.isActive, endDate: updated.endDate },
    });

    return updated;
  });

  server.get("/heroes/:id/hr", async (request) => {
    const { id } = request.params as { id: string };
    return getHeroHrDetailsByUserId(id);
  });

  server.patch("/heroes/:id/compensation", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const {
      branchId,
      mode,
      baseSalary,
      commissionPerOrder,
      isActive,
      notes,
      effectiveFrom,
      effectiveTo,
    } = parseObjectBody<{
      branchId?: string | null;
      mode?: StaffCompensationMode;
      baseSalary?: number | null;
      commissionPerOrder?: number | null;
      isActive?: boolean;
      notes?: string | null;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
    }>(request.body);

    const hero = await prisma.heroProfile.findUnique({
      where: { userId: id },
      include: {
        user: true,
        assignments: {
          where: { isActive: true },
          include: { branch: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!hero) {
      throw new AppError(404, "HERO_NOT_FOUND", "Hero not found");
    }

    const fallbackBranchId = branchId === undefined ? hero.assignments[0]?.branchId || null : branchId;

    const profile = await prisma.staffCompensationProfile.upsert({
      where: { userId: id },
      create: {
        userId: id,
        branchId: fallbackBranchId,
        target: StaffCompensationTarget.HERO,
        mode: mode || StaffCompensationMode.COMMISSION_ONLY,
        baseSalary: typeof baseSalary === "number" ? baseSalary : 0,
        commissionPerOrder: typeof commissionPerOrder === "number" ? commissionPerOrder : 0,
        isActive: isActive ?? true,
        notes: notes?.trim() || null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      },
      update: {
        branchId: fallbackBranchId,
        target: StaffCompensationTarget.HERO,
        mode: mode || undefined,
        baseSalary: typeof baseSalary === "number" ? baseSalary : undefined,
        commissionPerOrder:
          typeof commissionPerOrder === "number" ? commissionPerOrder : undefined,
        isActive: isActive ?? undefined,
        notes: notes === undefined ? undefined : notes?.trim() || null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        effectiveTo:
          effectiveTo === undefined ? undefined : effectiveTo ? new Date(effectiveTo) : null,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "HERO_COMPENSATION_UPDATED",
      entityType: "USER",
      entityId: id,
      after: {
        branchId: profile.branchId,
        mode: profile.mode,
        baseSalary: profile.baseSalary,
        commissionPerOrder: profile.commissionPerOrder,
        isActive: profile.isActive,
      },
    });

    return buildHeroCompensationSummary(id);
  });

  server.put("/heroes/:id/vacation-allowances/:type", async (request) => {
    const { id, type } = request.params as { id: string; type: VacationType };
    const actor = request.user as { id?: string; email?: string };
    const { totalDays, notes, isActive } = parseObjectBody<{
      totalDays?: number;
      notes?: string | null;
      isActive?: boolean;
    }>(request.body);

    if (typeof totalDays !== "number" || totalDays < 0) {
      throw new AppError(400, "VACATION_ALLOWANCE_TOTAL_REQUIRED", "totalDays must be zero or greater");
    }

    const allowance = await setHeroVacationAllowance({
      userId: id,
      type,
      totalDays,
      notes,
      isActive,
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "HERO_VACATION_ALLOWANCE_UPDATED",
      entityType: "USER",
      entityId: id,
      summary: {
        type,
        totalDays: allowance.totalDays,
        usedDays: allowance.usedDays,
        isActive: allowance.isActive,
      },
    });

    return getHeroHrDetailsByUserId(id);
  });

  server.patch("/vacation-requests/:id", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { status, decisionNote } = parseObjectBody<{
      status?: VacationRequestStatus;
      decisionNote?: string | null;
    }>(request.body);

    const isFinalVacationStatus =
      status === VacationRequestStatus.APPROVED ||
      status === VacationRequestStatus.REJECTED ||
      status === VacationRequestStatus.CANCELLED;

    if (!status || !isFinalVacationStatus) {
      throw new AppError(400, "VACATION_DECISION_INVALID", "A final vacation request status is required");
    }

    const finalStatus = status as Exclude<VacationRequestStatus, "PENDING">;

    const updated = await decideHeroVacationRequest({
      requestId: id,
      decidedById: actor.id || null,
      status: finalStatus,
      decisionNote,
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "HERO_VACATION_REQUEST_DECIDED",
      entityType: "HERO_VACATION_REQUEST",
      entityId: id,
      after: {
        status: updated.status,
        decidedAt: updated.decidedAt,
      },
    });

    return updated;
  });

  server.get("/zones", async (request, reply) => {
    const zones = await prisma.zone.findMany({
      include: {
        _count: {
          select: { supervisors: true, heroProfiles: true }
        }
      }
    });
    return zones;
  });

  server.post("/zones", async (request, reply) => {
    const { name, nameAr, boundaryWkt, city } = parseObjectBody<{
      name?: string;
      nameAr?: string | null;
      boundaryWkt?: string;
      city?: string;
    }>(request.body);

    if (!name?.trim() || !nameAr?.trim() || !boundaryWkt?.trim() || !city?.trim()) {
      throw new AppError(400, "ZONE_FIELDS_REQUIRED", "name, nameAr, boundaryWkt, and city are required");
    }
    
    const zone = await prisma.zone.create({
      data: {
        name: name.trim(),
        nameAr: nameAr.trim(),
        boundaryWkt: boundaryWkt.trim(),
        city: city.trim(),
      }
    });

    return zone;
  });

  server.post("/onboarding/merchant", async (request) => {
    const actor = request.user as { id?: string; email?: string };
    const {
      name,
      nameAr,
      ownerEmail,
      ownerName,
      ownerPhone,
      logoUrl,
      branchName,
      branchNameAr,
      branchAddress,
      branchPhone,
      branchWhatsappNumber,
      branchLat,
      branchLng,
      managerName,
      managerEmail,
      managerPhone,
    } = parseObjectBody<{
      name?: string;
      nameAr?: string | null;
      ownerEmail?: string;
      ownerName?: string;
      ownerPhone?: string | null;
      logoUrl?: string | null;
      branchName?: string;
      branchNameAr?: string | null;
      branchAddress?: string;
      branchPhone?: string | null;
      branchWhatsappNumber?: string | null;
      branchLat?: number;
      branchLng?: number;
      managerName?: string | null;
      managerEmail?: string | null;
      managerPhone?: string | null;
    }>(request.body);

    if (!name || !ownerEmail || !ownerName || !branchName || !branchAddress) {
      throw new AppError(400, "MERCHANT_ONBOARDING_FIELDS_REQUIRED", "Merchant, owner, and first branch fields are required");
    }
    if (typeof branchLat !== "number" || typeof branchLng !== "number") {
      throw new AppError(400, "BRANCH_LOCATION_REQUIRED", "A confirmed branch location is required");
    }

    const created = await prisma.$transaction(async (tx) => {
      const existingOwner = await tx.user.findUnique({
        where: { email: ownerEmail.trim().toLowerCase() },
      });
      if (existingOwner && existingOwner.role !== UserRole.MERCHANT_OWNER) {
        throw new AppError(409, "MERCHANT_OWNER_EMAIL_CONFLICT", "Owner email already belongs to a different user role");
      }

      const owner = await syncManagedUser(tx, {
        existingUserId: existingOwner?.id,
        name: ownerName.trim(),
        email: ownerEmail.trim().toLowerCase(),
        phone: ownerPhone?.trim() || null,
        role: UserRole.MERCHANT_OWNER,
        language: existingOwner?.language || "ar",
        isActive: existingOwner?.isActive ?? false,
      });

      let managerId: string | null = null;
      if (managerEmail?.trim()) {
        const normalizedManagerEmail = managerEmail.trim().toLowerCase();
        const existingManager = await tx.user.findUnique({
          where: { email: normalizedManagerEmail },
        });
        if (existingManager && existingManager.role !== UserRole.BRANCH_MANAGER) {
          throw new AppError(409, "BRANCH_MANAGER_EMAIL_CONFLICT", "Manager email already belongs to a different user role");
        }

        const manager = await syncManagedUser(tx, {
          existingUserId: existingManager?.id,
          name: managerName?.trim() || existingManager?.name || "Branch manager",
          email: normalizedManagerEmail,
          phone: managerPhone?.trim() || null,
          role: UserRole.BRANCH_MANAGER,
          language: existingManager?.language || "ar",
          isActive: existingManager?.isActive ?? false,
        });
        managerId = manager.id;
      }

      const merchant = await tx.merchantBrand.create({
        data: {
          name: name.trim(),
          nameAr: nameAr?.trim() || null,
          logoUrl: logoUrl?.trim() || null,
          ownerId: owner.id,
        },
      });

      await tx.merchantFinanceCase.create({
        data: {
          merchantId: merchant.id,
          scenario: MerchantFinanceScenario.PER_ORDER,
          settlementCycle: SettlementCycle.WEEKLY,
          currency: "EGP",
          isActive: true,
        },
      });

      const branch = await tx.branch.create({
        data: {
          brandId: merchant.id,
          managerId,
          name: branchName.trim(),
          nameAr: branchNameAr?.trim() || null,
          address: branchAddress.trim(),
          phone: branchPhone?.trim() || null,
          whatsappNumber: branchWhatsappNumber?.trim() || null,
          lat: branchLat,
          lng: branchLng,
        },
      });

      return { merchant, branch, owner };
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "MERCHANT_ONBOARDED",
      entityType: "MERCHANT",
      entityId: created.merchant.id,
      summary: {
        merchantName: created.merchant.nameAr || created.merchant.name,
        branchId: created.branch.id,
        ownerEmail: created.owner.email,
      },
      after: {
        merchantId: created.merchant.id,
        branchId: created.branch.id,
        ownerId: created.owner.id,
      },
    });

    return {
      merchantId: created.merchant.id,
      branchId: created.branch.id,
      ownerId: created.owner.id,
    };
  });

  server.post("/merchants", async (request, reply) => {
    const { name, nameAr, ownerEmail, ownerName, ownerPhone } = parseObjectBody<{
      name?: string;
      nameAr?: string | null;
      ownerEmail?: string;
      ownerName?: string;
      ownerPhone?: string | null;
    }>(request.body);
    const actor = request.user as { id?: string; email?: string };

    if (!name?.trim() || !ownerEmail?.trim() || !ownerName?.trim()) {
      throw new AppError(400, "MERCHANT_FIELDS_REQUIRED", "Merchant name, owner email, and owner name are required");
    }

    const merchant = await prisma.merchantBrand.create({
      data: {
        name: name.trim(),
        nameAr: nameAr?.trim() || null,
        owner: {
          create: {
            email: ownerEmail.trim().toLowerCase(),
            name: ownerName.trim(),
            phone: normalizePhone(ownerPhone),
            role: UserRole.MERCHANT_OWNER
          }
        }
      },
      include: { owner: true }
    });

    await prisma.merchantFinanceCase.create({
      data: {
        merchantId: merchant.id,
        scenario: MerchantFinanceScenario.PER_ORDER,
        settlementCycle: SettlementCycle.WEEKLY,
        currency: "EGP",
        isActive: true,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "MERCHANT_CREATED",
      entityType: "MERCHANT",
      entityId: merchant.id,
      summary: {
        merchantName: merchant.nameAr || merchant.name,
        ownerEmail: merchant.owner.email,
      },
      after: {
        merchantId: merchant.id,
        ownerId: merchant.owner.id,
      },
    });

    return merchant;
  });

  server.get("/merchants", async (request, reply) => {
    const { status = "ACTIVE" } = request.query as { status?: "ACTIVE" | "INACTIVE" | "ALL" };
    const merchants = await prisma.merchantBrand.findMany({
      where: {
        isActive: status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined,
      },
      include: {
        owner: true,
        branches: {
          select: { id: true },
        },
        _count: {
          select: {
            branches: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const merchantsWithOrders = await Promise.all(
      merchants.map(async (merchant) => {
        const branchIds = merchant.branches.map((branch) => branch.id);
        const orderCount = branchIds.length
          ? await prisma.order.count({
              where: {
                branchId: { in: branchIds },
              },
            })
          : 0;

        return {
          ...merchant,
          branchCount: merchant._count.branches,
          orderCount,
        };
      }),
    );

    return merchantsWithOrders;
  });

  server.get("/merchants/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getMerchantDetailPayload(id);
  });

  server.patch("/merchants/:id", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { name, nameAr, logoUrl, isActive, ownerName, ownerPhone, ownerLanguage } = parseObjectBody<{
      name?: string;
      nameAr?: string | null;
      logoUrl?: string | null;
      isActive?: boolean;
      ownerName?: string;
      ownerPhone?: string | null;
      ownerLanguage?: string | null;
    }>(request.body);

    const merchant = await prisma.merchantBrand.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!merchant) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant not found");
    }

    const before = await getMerchantDetailPayload(id);

    await prisma.$transaction(async (tx) => {
      await tx.merchantBrand.update({
        where: { id },
        data: {
          name: name?.trim() || undefined,
          nameAr: nameAr === undefined ? undefined : nameAr?.trim() || null,
          logoUrl: logoUrl === undefined ? undefined : logoUrl?.trim() || null,
          isActive,
        },
      });

      if (ownerName !== undefined || ownerPhone !== undefined || ownerLanguage !== undefined) {
        await tx.user.update({
          where: { id: merchant.ownerId },
          data: {
            name: ownerName?.trim() || undefined,
            phone: normalizePhone(ownerPhone),
            language: ownerLanguage === undefined ? undefined : ownerLanguage || "ar",
          },
        });
      }
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "MERCHANT_UPDATED",
      entityType: "MERCHANT",
      entityId: id,
      summary: {
        toggledActive: typeof isActive === "boolean" ? isActive : undefined,
      },
      before: {
        name: before.name,
        nameAr: before.nameAr,
        logoUrl: before.logoUrl,
        isActive: before.isActive,
        ownerName: before.owner.name,
        ownerPhone: before.owner.phone,
      },
      after: {
        name: name?.trim() || before.name,
        nameAr: nameAr === undefined ? before.nameAr : nameAr?.trim() || null,
        logoUrl: logoUrl === undefined ? before.logoUrl : logoUrl?.trim() || null,
        isActive: typeof isActive === "boolean" ? isActive : before.isActive,
        ownerName: ownerName?.trim() || before.owner.name,
        ownerPhone: ownerPhone === undefined ? before.owner.phone : ownerPhone?.trim() || null,
      },
    });

    return getMerchantDetailPayload(id);
  });

  server.patch("/merchants/:id/archive", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { archived } = parseObjectBody<{ archived?: boolean }>(request.body);

    const merchant = await prisma.merchantBrand.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!merchant) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant not found");
    }

    const nextActive = archived === true ? false : true;
    await prisma.merchantBrand.update({
      where: { id },
      data: { isActive: nextActive },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: nextActive ? "MERCHANT_RESTORED" : "MERCHANT_ARCHIVED",
      entityType: "MERCHANT",
      entityId: id,
      before: { isActive: merchant.isActive },
      after: { isActive: nextActive },
    });

    return getMerchantDetailPayload(id);
  });

  server.get("/branches", async (request) => {
    const { status = "ACTIVE" } = request.query as { status?: "ACTIVE" | "INACTIVE" | "ALL" };
    const branches = await prisma.branch.findMany({
      where: {
        isActive: status === "ACTIVE" ? true : status === "INACTIVE" ? false : undefined,
      },
      include: {
        brand: {
          include: {
            owner: true,
          },
        },
        manager: true,
        _count: {
          select: {
            orders: true,
            heroAssignments: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      nameAr: branch.nameAr,
      address: branch.address,
      lat: branch.lat,
      lng: branch.lng,
      phone: branch.phone,
      whatsappNumber: branch.whatsappNumber,
      isActive: branch.isActive,
      createdAt: branch.createdAt,
      merchant: {
        id: branch.brand.id,
        name: branch.brand.name,
        nameAr: branch.brand.nameAr,
        owner: {
          name: branch.brand.owner.name,
          email: branch.brand.owner.email,
          phone: branch.brand.owner.phone,
        },
      },
      manager: branch.manager
        ? {
            id: branch.manager.id,
            name: branch.manager.name,
            email: branch.manager.email,
            phone: branch.manager.phone,
          }
        : null,
      orderCount: branch._count.orders,
      activeHeroAssignments: branch._count.heroAssignments,
    }));
  });

  server.get("/branches/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getBranchDetailPayload(id);
  });

  server.post("/branches", async (request) => {
    const actor = request.user as { id?: string; email?: string };
    const {
      merchantId,
      name,
      nameAr,
      address,
      phone,
      whatsappNumber,
      lat,
      lng,
      managerName,
      managerEmail,
      managerPhone,
    } = parseObjectBody<{
      merchantId?: string;
      name?: string;
      nameAr?: string;
      address?: string;
      phone?: string;
      whatsappNumber?: string;
      lat?: number;
      lng?: number;
      managerName?: string;
      managerEmail?: string;
      managerPhone?: string;
    }>(request.body);

    if (!merchantId || !name || !address) {
      throw new AppError(400, "BRANCH_FIELDS_REQUIRED", "merchantId, name, and address are required");
    }
    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new AppError(400, "BRANCH_LOCATION_REQUIRED", "A confirmed branch location is required");
    }

    const merchant = await prisma.merchantBrand.findUnique({
      where: { id: merchantId },
      include: {
        branches: {
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });

    if (!merchant) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant not found");
    }

    let managerId: string | undefined;

    if (managerEmail) {
      const normalizedManagerEmail = managerEmail.trim().toLowerCase();
      const existingManager = await prisma.user.findUnique({
        where: { email: normalizedManagerEmail },
      });

      if (existingManager && existingManager.role !== UserRole.BRANCH_MANAGER) {
        throw new AppError(409, "BRANCH_MANAGER_EMAIL_CONFLICT", "Manager email already belongs to a different user role");
      }

      const manager = await syncManagedUser(prisma, {
        existingUserId: existingManager?.id,
        name: managerName || existingManager?.name || "Branch manager",
        email: normalizedManagerEmail,
        phone: managerPhone,
        role: UserRole.BRANCH_MANAGER,
        language: existingManager?.language || "ar",
        isActive: true,
      });

      managerId = manager.id;
    }

    const branch = await prisma.branch.create({
      data: {
        brandId: merchant.id,
        managerId,
        name,
        nameAr,
        address,
        phone: normalizePhone(phone),
        whatsappNumber: normalizePhone(whatsappNumber),
        lat,
        lng,
      },
      include: {
        brand: true,
        manager: true,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "BRANCH_CREATED",
      entityType: "BRANCH",
      entityId: branch.id,
      summary: {
        branchName: branch.nameAr || branch.name,
        merchantId: branch.brandId,
        managerId,
      },
      after: {
        branchId: branch.id,
        brandId: branch.brandId,
        managerId,
        lat: branch.lat,
        lng: branch.lng,
      },
    });

    if (branch.lat === 30.0444 && branch.lng === 31.2357) {
      await raiseOperationalAlert({
        dedupeKey: `stale-branch-coordinates:${branch.id}`,
        kind: "STALE_BRANCH_COORDINATES",
        severity: "medium",
        titleCode: "branches.coordinates.title",
        messageCode: "branches.coordinates.message",
        entityType: "BRANCH",
        entityId: branch.id,
        actionHref: `/admin/branches/${branch.id}`,
        metadata: {
          branchId: branch.id,
          branchName: branch.nameAr || branch.name,
          merchantId: branch.brandId,
          merchantName: branch.brand.nameAr || branch.brand.name,
        },
      });
    }

    return branch;
  });

  server.patch("/branches/:id", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const {
      name,
      nameAr,
      address,
      phone,
      whatsappNumber,
      lat,
      lng,
      isActive,
      managerName,
      managerEmail,
      managerPhone,
    } = parseObjectBody<{
      name?: string;
      nameAr?: string | null;
      address?: string;
      phone?: string | null;
      whatsappNumber?: string | null;
      lat?: number;
      lng?: number;
      isActive?: boolean;
      managerName?: string;
      managerEmail?: string | null;
      managerPhone?: string | null;
    }>(request.body);

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        manager: true,
      },
    });

    if (!branch) {
      throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
    }

    const before = await getBranchDetailPayload(id);

    let managerId = branch.managerId;

    if (managerEmail) {
      const normalizedManagerEmail = managerEmail.trim().toLowerCase();
      const existingManager = await prisma.user.findUnique({
        where: { email: normalizedManagerEmail },
      });

      if (existingManager && existingManager.role !== UserRole.BRANCH_MANAGER) {
        throw new AppError(409, "BRANCH_MANAGER_EMAIL_CONFLICT", "Manager email already belongs to another user role");
      }

      const manager = await syncManagedUser(prisma, {
        existingUserId: existingManager?.id,
        name: managerName || existingManager?.name || "Branch manager",
        email: normalizedManagerEmail,
        phone: managerPhone,
        role: UserRole.BRANCH_MANAGER,
        language: existingManager?.language || "ar",
        isActive: true,
      });

      managerId = manager.id;
    }

    await prisma.branch.update({
      where: { id },
      data: {
        managerId,
        name: name?.trim() || undefined,
        nameAr: nameAr === undefined ? undefined : nameAr?.trim() || null,
        address: address?.trim() || undefined,
        phone: phone === undefined ? undefined : normalizePhone(phone),
        whatsappNumber: whatsappNumber === undefined ? undefined : normalizePhone(whatsappNumber),
        lat: typeof lat === "number" ? lat : undefined,
        lng: typeof lng === "number" ? lng : undefined,
        isActive,
      },
    });

    if (typeof lat === "number" && typeof lng === "number") {
      await resolveOperationalAlert(`stale-branch-coordinates:${id}`);
    }

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: managerId !== branch.managerId ? "BRANCH_MANAGER_REASSIGNED" : "BRANCH_UPDATED",
      entityType: "BRANCH",
      entityId: id,
      summary: {
        managerChanged: managerId !== branch.managerId,
        toggledActive: typeof isActive === "boolean" ? isActive : undefined,
      },
      before: {
        name: before.name,
        nameAr: before.nameAr,
        address: before.address,
        phone: before.phone,
        whatsappNumber: before.whatsappNumber,
        lat: before.lat,
        lng: before.lng,
        isActive: before.isActive,
        managerEmail: before.manager?.email || null,
      },
      after: {
        name: name?.trim() || before.name,
        nameAr: nameAr === undefined ? before.nameAr : nameAr?.trim() || null,
        address: address?.trim() || before.address,
        phone: phone === undefined ? before.phone : phone?.trim() || null,
        whatsappNumber: whatsappNumber === undefined ? before.whatsappNumber : whatsappNumber?.trim() || null,
        lat: typeof lat === "number" ? lat : before.lat,
        lng: typeof lng === "number" ? lng : before.lng,
        isActive: typeof isActive === "boolean" ? isActive : before.isActive,
        managerEmail: managerEmail === undefined ? before.manager?.email || null : managerEmail?.trim() || null,
      },
    });

    return getBranchDetailPayload(id);
  });

  server.patch("/branches/:id/archive", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { archived } = parseObjectBody<{ archived?: boolean }>(request.body);

    const branch = await prisma.branch.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!branch) {
      throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
    }

    const nextActive = archived === true ? false : true;
    await prisma.branch.update({
      where: { id },
      data: { isActive: nextActive },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: nextActive ? "BRANCH_RESTORED" : "BRANCH_ARCHIVED",
      entityType: "BRANCH",
      entityId: id,
      before: { isActive: branch.isActive },
      after: { isActive: nextActive },
    });

    return getBranchDetailPayload(id);
  });

  server.get("/customers", async (request) => {
    const { q, merchantId } = request.query as { q?: string; merchantId?: string };
    return listCustomersForAdmin(q, merchantId);
  });

  server.get("/customers/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getCustomerDetailForAdmin(id);
  });

  server.patch("/customers/:id", async (request) => {
    const { id } = request.params as { id: string };
    return updateCustomerForAdmin(id, request.body as any, request.user as { id?: string; email?: string });
  });

  server.get("/alerts", async () => {
    return getAdminOperationalAlerts();
  });

  server.get("/map/live", async () => {
    const [heroes, orders, zones] = await Promise.all([
      prisma.heroProfile.findMany({
        include: {
          user: true,
          zone: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 48,
      }),
      prisma.order.findMany({
        where: {
          status: { notIn: ["DELIVERED", "FAILED", "CANCELLED"] },
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
        take: 48,
      }),
      prisma.zone.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          nameAr: true,
          boundaryWkt: true,
        },
      }),
    ]);

    return {
      heroes: heroes.map((hero) => ({
        id: hero.id,
        status: hero.status,
        currentLat: hero.currentLat,
        currentLng: hero.currentLng,
        efficiencyScore: hero.efficiencyScore,
        totalDeliveries: hero.totalDeliveries,
        ordersToday: hero.ordersToday,
        user: {
          id: hero.user.id,
          name: hero.user.name,
          email: hero.user.email,
        },
        zone: hero.zone
          ? {
              id: hero.zone.id,
              name: hero.zone.name,
              nameAr: hero.zone.nameAr,
            }
          : null,
      })),
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryAddress: order.deliveryAddress,
        requestedAt: order.requestedAt,
        branch: {
          id: order.branch.id,
          name: order.branch.name,
          nameAr: order.branch.nameAr,
          brandName: order.branch.brand.nameAr || order.branch.brand.name,
          lat: order.branch.lat,
          lng: order.branch.lng,
        },
        zone: {
          id: order.zone.id,
          name: order.zone.name,
          nameAr: order.zone.nameAr,
        },
        deliveryLat: order.deliveryLat,
        deliveryLng: order.deliveryLng,
        hero: order.hero
          ? {
              id: order.hero.id,
              name: order.hero.user.name,
            }
          : null,
      })),
      zones,
    };
  });

  server.patch("/orders/:id/assignment", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { heroId, note } = parseObjectBody<{ heroId?: string; note?: string }>(request.body);

    if (!heroId?.trim()) {
      throw new AppError(400, "HERO_ID_REQUIRED", "heroId is required");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        hero: true,
      },
    });

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (!MANUAL_ASSIGNABLE_ORDER_STATUSES.includes(order.status as (typeof MANUAL_ASSIGNABLE_ORDER_STATUSES)[number])) {
      throw new AppError(409, "ORDER_NOT_ASSIGNABLE", "Only new or early-stage orders can be reassigned");
    }

    const { hero: eligibleHero, eligibleHeroes } = await assertHeroEligibleForOrder(id, heroId.trim());
    if (!eligibleHero) {
      throw new AppError(409, "HERO_NOT_ELIGIBLE", "The selected hero is not eligible for this order", {
        eligibleHeroIds: eligibleHeroes.map((hero) => hero.heroId),
      });
    }

    const previousHeroId = order.heroId;
    const shouldIncrementOrdersToday = !order.assignedAt;

    const updated = await prisma.$transaction(async (tx) => {
      const changedOrder = await tx.order.update({
        where: { id },
        data: {
          heroId: eligibleHero.heroId,
          status: "ASSIGNED",
          assignedAt: order.assignedAt || new Date(),
          statusHistory: {
            create: {
              status: "ASSIGNED",
              changedBy: actor.id,
              note: note?.trim() || `Admin manual assignment (${eligibleHero.assignmentReason})`,
            },
          },
        },
        include: {
          branch: {
            include: { brand: true },
          },
          hero: {
            include: { user: true },
          },
          zone: true,
        },
      });

      await tx.heroProfile.update({
        where: { id: eligibleHero.heroId },
        data: {
          status: "ON_DELIVERY",
          lastOrderAt: new Date(),
          ordersToday: shouldIncrementOrdersToday ? { increment: 1 } : undefined,
        },
      });

      return changedOrder;
    });

    if (previousHeroId && previousHeroId !== eligibleHero.heroId) {
      await releaseHeroIfIdle(previousHeroId);
    }

    await resolveOperationalAlert(`unassigned-order:${id}`);
    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: previousHeroId && previousHeroId !== eligibleHero.heroId ? "ORDER_REASSIGNED" : "ORDER_ASSIGNED_MANUALLY",
      entityType: "ORDER",
      entityId: id,
      summary: {
        orderNumber: updated.orderNumber,
        heroId: eligibleHero.heroId,
        previousHeroId,
        assignmentReason: eligibleHero.assignmentReason,
      },
      before: {
        heroId: previousHeroId,
        status: order.status,
      },
      after: {
        heroId: eligibleHero.heroId,
        status: updated.status,
      },
    });

    server.broadcast(
      "ORDER_STATUS_UPDATE",
      {
        orderId: updated.id,
        trackingId: updated.trackingId,
        status: updated.status,
        heroId: updated.heroId,
      },
      { channels: ["orders", "live-map"] },
    );

    return {
      id: updated.id,
      heroId: updated.heroId,
      status: updated.status,
      orderNumber: updated.orderNumber,
    };
  });

  server.post("/orders/:id/dispatch/retry", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { note } = request.body as { note?: string };

    const order = await prisma.order.findUnique({
      where: { id },
      include: { hero: true },
    });

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    }

    if (!MANUAL_ASSIGNABLE_ORDER_STATUSES.includes(order.status as (typeof MANUAL_ASSIGNABLE_ORDER_STATUSES)[number])) {
      throw new AppError(409, "ORDER_NOT_RETRYABLE", "This order can no longer be sent back to dispatch");
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          heroId: null,
          status: "REQUESTED",
          assignedAt: null,
          statusHistory: {
            create: {
              status: "REQUESTED",
              changedBy: actor.id,
              note: note?.trim() || "Admin requested dispatch retry",
            },
          },
        },
      });
    });

    if (order.heroId) {
      await releaseHeroIfIdle(order.heroId);
    }

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "ORDER_DISPATCH_RETRY_QUEUED",
      entityType: "ORDER",
      entityId: id,
      summary: {
        orderNumber: order.orderNumber,
      },
      before: {
        heroId: order.heroId,
        status: order.status,
      },
      after: {
        heroId: null,
        status: "REQUESTED",
      },
    });

    await enqueueAssignmentJob({ orderId: id, source: "manual_reassign" }, server.log);

    return {
      queued: true,
      orderId: id,
      status: "REQUESTED",
    };
  });

  server.get("/orders", async () => {
    const orders = await prisma.order.findMany({
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
      take: 80,
    });

    const eligibleHeroesByOrder = new Map<string, Awaited<ReturnType<typeof listEligibleHeroesForOrder>>["eligibleHeroes"]>();
    for (const order of orders) {
      const { eligibleHeroes } = await listEligibleHeroesForOrder(order.id);
      eligibleHeroesByOrder.set(order.id, eligibleHeroes);
    }

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryFee: order.deliveryFee,
      requestedAt: order.requestedAt,
      deliveredAt: order.deliveredAt,
      deliveryAddress: order.deliveryAddress,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      heroId: order.heroId,
      branch: {
        id: order.branch.id,
        name: order.branch.name,
        nameAr: order.branch.nameAr,
        brandName: order.branch.brand.nameAr || order.branch.brand.name,
      },
      hero: order.hero
        ? {
            id: order.hero.id,
            name: order.hero.user.name,
          }
        : null,
      zone: {
        id: order.zone.id,
        name: order.zone.name,
        nameAr: order.zone.nameAr,
      },
      eligibleHeroes: (eligibleHeroesByOrder.get(order.id) || []).map((hero) => ({
        id: hero.heroId,
        userId: hero.userId,
        name: hero.name,
        phone: hero.phone,
        status: hero.status,
        distanceKm: hero.distanceKm,
        activeOrders: hero.activeOrders,
        assignmentReason: hero.assignmentReason,
        zone: {
          id: hero.zoneId,
          name: hero.zoneName,
          nameAr: hero.zoneNameAr,
        },
      })),
    }));
  });

  server.get("/invoices", async () => {
    const invoices = await prisma.invoice.findMany({
      include: {
        brand: true,
        lineItems: true,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      brandId: invoice.brandId,
      merchantName: invoice.brand.nameAr || invoice.brand.name,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      lineItemsCount: invoice.lineItems.length,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
    }));
  });

  server.get("/payouts", async () => {
    const payouts = await prisma.payout.findMany({
      include: {
        hero: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return payouts.map((payout) => ({
      id: payout.id,
      status: payout.status,
      totalAmount: payout.totalAmount,
      currency: payout.currency,
      baseSalary: payout.baseSalary,
      orderBonus: payout.orderBonus,
      penalties: payout.penalties,
      createdAt: payout.createdAt,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      hero: {
        id: payout.hero.id,
        name: payout.hero.user.name,
        email: payout.hero.user.email,
      },
    }));
  });

  server.get("/finance/merchants", async (request) => {
    const { merchantId, from, to } = request.query as { merchantId?: string; from?: string; to?: string };
    const range = coerceDateRange({ from, to });

    if (merchantId) {
      const summary = await buildMerchantFinanceSummary(merchantId, range);
      return {
        merchants: summary ? [summary] : [],
      };
    }

    return {
      merchants: await listMerchantFinanceSummaries(range),
    };
  });

  server.get("/finance/merchants/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { from, to } = request.query as { from?: string; to?: string };
    const range = coerceDateRange({ from, to });
    const summary = await buildMerchantFinanceSummary(id, range);

    if (!summary) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant not found");
    }

    const createdAt = range.from || range.to ? { gte: range.from, lte: range.to } : undefined;
    const [transactions, invoices, branches] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          merchantId: id,
          createdAt,
        },
        orderBy: { createdAt: "desc" },
        take: 120,
      }),
      prisma.invoice.findMany({
        where: {
          brandId: id,
          createdAt,
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.branch.findMany({
        where: {
          brandId: id,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    return {
      ...summary,
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        nameAr: branch.nameAr,
        isActive: branch.isActive,
      })),
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        reference: transaction.reference,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt.toISOString(),
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.dueDate.toISOString(),
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
      })),
    };
  });

  server.patch("/finance/merchants/:id/case", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const {
      type,
      scenario,
      value,
      settlementRate,
      retainerAmount,
      perOrderFee,
      settlementCycle,
      currency,
      validFrom,
      validUntil,
      notes,
      isActive,
    } = parseObjectBody<{
      type?: ContractType;
      scenario?: MerchantFinanceScenario | null;
      value?: number | null;
      settlementRate?: number | null;
      retainerAmount?: number | null;
      perOrderFee?: number | null;
      settlementCycle?: SettlementCycle | null;
      currency?: string;
      validFrom?: string;
      validUntil?: string | null;
      notes?: string | null;
      isActive?: boolean;
    }>(request.body);

    if ((!type && !scenario) || !validFrom) {
      throw new AppError(400, "FINANCE_CASE_FIELDS_REQUIRED", "type and validFrom are required");
    }

    const nextScenario = scenario || contractTypeToScenario(type as ContractType);
    const nextType = type || scenarioToLegacyContractType(nextScenario, settlementCycle);

    const merchant = await prisma.merchantBrand.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!merchant) {
      throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant not found");
    }

    const current = await prisma.contract.findFirst({
      where: { brandId: id, isActive: true },
      orderBy: { validFrom: "desc" },
    });

    const next = current
      ? await prisma.contract.update({
          where: { id: current.id },
          data: {
            type: nextType,
            value: deriveContractValue({ type: nextType, value, retainerAmount, perOrderFee }),
            settlementRate,
            retainerAmount,
            perOrderFee,
            currency: currency || current.currency,
            validFrom: new Date(validFrom),
            validUntil: validUntil ? new Date(validUntil) : null,
            notes: notes?.trim() || null,
            isActive: isActive ?? true,
          },
        })
      : await prisma.contract.create({
          data: {
            brandId: id,
            type: nextType,
            value: deriveContractValue({ type: nextType, value, retainerAmount, perOrderFee }),
            settlementRate,
            retainerAmount,
            perOrderFee,
            currency: currency || "EGP",
            validFrom: new Date(validFrom),
            validUntil: validUntil ? new Date(validUntil) : null,
            notes: notes?.trim() || null,
            isActive: isActive ?? true,
          },
        });

    await prisma.merchantFinanceCase.upsert({
      where: { merchantId: id },
      create: {
        merchantId: id,
        scenario: nextScenario,
        settlementCycle: settlementCycle || SettlementCycle.WEEKLY,
        settlementRate: settlementRate ?? null,
        retainerAmount: retainerAmount ?? null,
        perOrderFee: perOrderFee ?? null,
        currency: currency || "EGP",
        effectiveFrom: new Date(validFrom),
        effectiveTo: validUntil ? new Date(validUntil) : null,
        isActive: isActive ?? true,
        notes: notes?.trim() || null,
      },
      update: {
        scenario: nextScenario,
        settlementCycle: settlementCycle || SettlementCycle.WEEKLY,
        settlementRate: settlementRate ?? null,
        retainerAmount: retainerAmount ?? null,
        perOrderFee: perOrderFee ?? null,
        currency: currency || next.currency,
        effectiveFrom: new Date(validFrom),
        effectiveTo: validUntil ? new Date(validUntil) : null,
        isActive: isActive ?? true,
        notes: notes?.trim() || null,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: current ? "MERCHANT_FINANCE_CASE_UPDATED" : "MERCHANT_FINANCE_CASE_CREATED",
      entityType: "MERCHANT",
      entityId: id,
      before: current
        ? {
            type: current.type,
            value: current.value,
            settlementRate: current.settlementRate,
            retainerAmount: current.retainerAmount,
            perOrderFee: current.perOrderFee,
          }
        : null,
      after: {
        type: next.type,
        scenario: nextScenario,
        value: next.value,
        settlementCycle: settlementCycle || SettlementCycle.WEEKLY,
        settlementRate: next.settlementRate,
        retainerAmount: next.retainerAmount,
        perOrderFee: next.perOrderFee,
      },
    });

    return buildMerchantFinanceSummary(id, {});
  });

  server.post("/finance/merchants/:id/adjustments", async (request) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id?: string; email?: string };
    const { amount, direction, note, reference } = parseObjectBody<{
      amount?: number;
      direction?: "CREDIT" | "DEBIT";
      note?: string;
      reference?: string;
    }>(request.body);

    if (!amount || amount <= 0 || !direction) {
      throw new AppError(400, "FINANCE_ADJUSTMENT_FIELDS_REQUIRED", "amount and direction are required");
    }

    const signedAmount = direction === "DEBIT" ? -Math.abs(amount) : Math.abs(amount);
    await prisma.$transaction(async (tx) => {
      const financeCase = await tx.merchantFinanceCase.findUnique({
        where: { merchantId: id },
        select: { id: true },
      });

      await tx.merchantBrand.update({
        where: { id },
        data: {
          walletBalance: { increment: signedAmount },
        },
      });

      await tx.transaction.create({
        data: {
          merchantId: id,
          type: TransactionType.ADJUSTMENT,
          status: "SUCCESS",
          amount: signedAmount,
          reference: reference?.trim() || null,
          description: note?.trim() || `Admin ${direction.toLowerCase()} adjustment`,
          metadata: {
            direction,
            actorEmail: actor.email || null,
          },
        },
      });

      await tx.financeLedgerEntry.create({
        data: {
          merchantId: id,
          merchantFinanceCaseId: financeCase?.id || null,
          entryType: "ADJUSTMENT",
          amount: signedAmount,
          description: note?.trim() || `Admin ${direction.toLowerCase()} adjustment`,
          reference: reference?.trim() || null,
          metadata: {
            direction,
            actorEmail: actor.email || null,
            source: "admin_adjustment",
          },
        },
      });
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "MERCHANT_FINANCE_ADJUSTMENT_CREATED",
      entityType: "MERCHANT",
      entityId: id,
      summary: {
        amount: signedAmount,
        direction,
      },
    });

    return buildMerchantFinanceSummary(id, {});
  });

  server.get("/reports/insights", async (request) => {
    const { merchantId, from, to } = request.query as {
      merchantId?: string;
      from?: string;
      to?: string;
    };
    const range = coerceDateRange({ from, to });
    const requestedAtFilter = buildDateRangeFilter(range);
    const createdAtFilter = buildDateRangeFilter(range);
    const branchIds = merchantId
      ? (
          await prisma.branch.findMany({
            where: { brandId: merchantId },
            select: { id: true },
          })
        ).map((branch) => branch.id)
      : null;
    const branchScope = branchIds ? { in: branchIds.length ? branchIds : ["__none__"] } : undefined;

    const [orders, payouts, invoices, zones, heroes, merchants, financeSummaries] = await Promise.all([
      prisma.order.findMany({
        where: {
          branchId: branchScope,
          requestedAt: requestedAtFilter,
        },
        include: {
          branch: {
            include: {
              brand: true,
            },
          },
        },
      }),
      prisma.payout.findMany({
        where: {
          status: "PENDING",
          createdAt: createdAtFilter,
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
        take: 8,
      }),
      prisma.invoice.findMany({
        where: {
          brandId: merchantId,
          createdAt: createdAtFilter,
        },
        include: {
          brand: true,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.zone.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              heroProfiles: true,
            },
          },
        },
      }),
      prisma.heroProfile.findMany({
        where: merchantId
          ? {
              assignments: {
                some: {
                  isActive: true,
                  branch: {
                    brandId: merchantId,
                  },
                },
              },
            }
          : undefined,
        include: {
          user: true,
        },
      }),
      prisma.merchantBrand.findMany({
        where: merchantId ? { id: merchantId } : { isActive: true },
        include: {
          branches: {
            select: { id: true },
          },
        },
      }),
      merchantId
        ? Promise.all([buildMerchantFinanceSummary(merchantId, range)]).then((rows) => rows.filter(Boolean))
        : listMerchantFinanceSummaries(range),
    ]);

    const filteredPayouts = merchantId
      ? payouts.filter((payout) =>
          payout.hero.assignments.some((assignment) => assignment.branch.brandId === merchantId),
        )
      : payouts;
    const deliveredOrders = orders.filter((order) => order.status === "DELIVERED");
    const revenue = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
    const heroPayouts = filteredPayouts.reduce((sum, payout) => sum + payout.totalAmount, 0);
    const overdueInvoices = invoices.filter((invoice) => invoice.status === "OVERDUE");

    const merchantRows = merchants
      .map((merchant) => {
        const merchantBranchIds = new Set(merchant.branches.map((branch) => branch.id));
        const merchantOrders = orders.filter((order) => merchantBranchIds.has(order.branchId));

        return {
          id: merchant.id,
          name: merchant.nameAr || merchant.name,
          orderCount: merchantOrders.length,
          revenue: merchantOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0),
          avgDeliveryMins: merchantOrders.length
            ? Math.round(
                merchantOrders.reduce((sum, order) => {
                  if (!order.deliveredAt) return sum;
                  return (
                    sum +
                    Math.max(
                      0,
                      Math.round((order.deliveredAt.getTime() - order.requestedAt.getTime()) / 60000),
                    )
                  );
                }, 0) / merchantOrders.length,
              )
            : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const zoneRows = zones
      .map((zone) => {
        const zoneOrders = orders.filter((order) => order.zoneId === zone.id);
        return {
          id: zone.id,
          name: zone.nameAr || zone.name,
          city: zone.city,
          activeHeroes: zone._count.heroProfiles,
          orders: zoneOrders.length,
          revenue: zoneOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0),
        };
      })
      .filter((zone) => !merchantId || zone.orders > 0);

    const heroRows = heroes
      .map((hero) => {
        const heroOrders = deliveredOrders.filter((order) => order.heroId === hero.id);
        return {
          id: hero.id,
          name: hero.user.name,
          status: hero.status,
          deliveredOrders: heroOrders.length,
          earnings: heroOrders.reduce((sum, order) => sum + (order.heroPayout || 0), 0),
        };
      })
      .sort((a, b) => b.deliveredOrders - a.deliveredOrders)
      .slice(0, 6);

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        merchantId: merchantId || null,
        from: range.from?.toISOString() || null,
        to: range.to?.toISOString() || null,
      },
      kpis: {
        totalOrders: orders.length,
        deliveredOrders: deliveredOrders.length,
        totalRevenue: revenue,
        pendingPayouts: heroPayouts,
        overdueInvoices: overdueInvoices.length,
      },
      exports: [
        { key: "orders", labelAr: "سجل الطلبات", count: orders.length, fileHint: "Excel / CSV" },
        { key: "payouts", labelAr: "مدفوعات الطيارين", count: filteredPayouts.length, fileHint: "Excel / CSV" },
        { key: "invoices", labelAr: "فواتير التجار", count: invoices.length, fileHint: "Excel / CSV" },
        {
          key: "finance",
          labelAr: merchantId ? "ملف المالية للتاجر" : "ملفات التسويات",
          count: financeSummaries.length,
          fileHint: "Excel / CSV",
        },
      ],
      merchants: merchantRows,
      zones: zoneRows,
      heroes: heroRows,
      finance: financeSummaries,
      payoutQueue: filteredPayouts.map((payout) => ({
        id: payout.id,
        heroName: payout.hero.user.name,
        totalAmount: payout.totalAmount,
        baseSalary: payout.baseSalary,
        orderBonus: payout.orderBonus,
        penalties: payout.penalties,
        createdAt: payout.createdAt,
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        merchantName: invoice.brand.nameAr || invoice.brand.name,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        dueDate: invoice.dueDate,
      })),
    };
  });

  server.get("/reports/export-file/:key", async (request, reply) => {
    const { key } = request.params as { key: "orders" | "payouts" | "invoices" | "summary" | "finance" };
    const { format = "csv", merchantId, from, to } = request.query as {
      format?: "csv" | "json";
      merchantId?: string;
      from?: string;
      to?: string;
    };

    if (!["orders", "payouts", "invoices", "summary", "finance"].includes(key)) {
      throw new AppError(400, "REPORT_EXPORT_INVALID", "Unknown export key");
    }

    if (!["csv", "json"].includes(format)) {
      throw new AppError(400, "REPORT_EXPORT_FORMAT_INVALID", "Unsupported export format");
    }

    const exportFile = await buildAdminReportExport(key, format, {
      merchantId,
      ...coerceDateRange({ from, to }),
    });

    reply.header("Content-Type", exportFile.contentType);
    reply.header("Content-Disposition", `attachment; filename=\"${exportFile.filename}\"`);
    return reply.send(exportFile.body);
  });

  server.get("/settings/overview", async () => {
    const [users, zones, activeHeroes, merchants] = await Promise.all([
      prisma.user.count(),
      prisma.zone.count(),
      prisma.heroProfile.count({
        where: { status: { not: "OFFLINE" } },
      }),
      prisma.merchantBrand.count(),
    ]);

    return {
      locale: "ar-EG",
      defaultTheme: "midnight",
      websocketEnabled: true,
      devMode: env.ALLOW_DEV_AUTH || false,
      transports: NotificationService.transportStatus(),
      stats: {
        users,
        zones,
        activeHeroes,
        merchants,
      },
      policies: [
        { key: "merchant_topup", labelAr: "الشحن الفوري للتاجر", enabled: true },
        { key: "live_tracking", labelAr: "التتبع المباشر", enabled: true },
        { key: "reports_exports", labelAr: "تصدير التقارير", enabled: true },
      ],
    };
  });

  server.get("/reports/overview", async (request) => {
    const { merchantId, from, to } = request.query as {
      merchantId?: string;
      from?: string;
      to?: string;
    };
    const range = coerceDateRange({ from, to });
    const requestedAtFilter = buildDateRangeFilter(range);
    const createdAtFilter = buildDateRangeFilter(range);
    const branchIds = merchantId
      ? (
          await prisma.branch.findMany({
            where: { brandId: merchantId },
            select: { id: true },
          })
        ).map((branch) => branch.id)
      : null;
    const branchScope = branchIds ? { in: branchIds.length ? branchIds : ["__none__"] } : undefined;

    const [orders, payouts, invoices, zones, heroes, merchants, financeSummaries] = await Promise.all([
      prisma.order.findMany({
        where: {
          branchId: branchScope,
          requestedAt: requestedAtFilter,
        },
        include: {
          branch: {
            include: {
              brand: true,
            },
          },
        },
      }),
      prisma.payout.findMany({
        where: {
          status: "PENDING",
          createdAt: createdAtFilter,
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
        take: 8,
      }),
      prisma.invoice.findMany({
        where: {
          brandId: merchantId,
          createdAt: createdAtFilter,
        },
        include: {
          brand: true,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.zone.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              heroProfiles: true,
            },
          },
        },
      }),
      prisma.heroProfile.findMany({
        where: merchantId
          ? {
              assignments: {
                some: {
                  isActive: true,
                  branch: {
                    brandId: merchantId,
                  },
                },
              },
            }
          : undefined,
        include: {
          user: true,
        },
      }),
      prisma.merchantBrand.findMany({
        where: merchantId ? { id: merchantId } : { isActive: true },
        include: {
          branches: {
            select: { id: true },
          },
        },
      }),
      merchantId
        ? Promise.all([buildMerchantFinanceSummary(merchantId, range)]).then((rows) => rows.filter(Boolean))
        : listMerchantFinanceSummaries(range),
    ]);

    const filteredPayouts = merchantId
      ? payouts.filter((payout) =>
          payout.hero.assignments.some((assignment) => assignment.branch.brandId === merchantId),
        )
      : payouts;
    const deliveredOrders = orders.filter((order) => order.status === "DELIVERED");
    const revenue = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
    const heroPayouts = filteredPayouts.reduce((sum, payout) => sum + payout.totalAmount, 0);
    const overdueInvoices = invoices.filter((invoice) => invoice.status === "OVERDUE");

    const merchantRows = merchants
      .map((merchant) => {
        const branchIds = new Set(merchant.branches.map((branch) => branch.id));
        const merchantOrders = orders.filter((order) => branchIds.has(order.branchId));

        return {
          id: merchant.id,
          name: merchant.nameAr || merchant.name,
          orderCount: merchantOrders.length,
          revenue: merchantOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0),
          avgDeliveryMins: merchantOrders.length
            ? Math.round(
                merchantOrders.reduce((sum, order) => {
                  if (!order.deliveredAt) return sum;
                  return sum + Math.max(0, Math.round((order.deliveredAt.getTime() - order.requestedAt.getTime()) / 60000));
                }, 0) / merchantOrders.length,
              )
            : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const zoneRows = zones
      .map((zone) => {
        const zoneOrders = orders.filter((order) => order.zoneId === zone.id);
        return {
          id: zone.id,
          name: zone.nameAr || zone.name,
          city: zone.city,
          activeHeroes: zone._count.heroProfiles,
          orders: zoneOrders.length,
          revenue: zoneOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0),
        };
      })
      .filter((zone) => !merchantId || zone.orders > 0);

    const heroRows = heroes
      .map((hero) => {
        const heroOrders = deliveredOrders.filter((order) => order.heroId === hero.id);
        return {
          id: hero.id,
          name: hero.user.name,
          status: hero.status,
          deliveredOrders: heroOrders.length,
          earnings: heroOrders.reduce((sum, order) => sum + (order.heroPayout || 0), 0),
        };
      })
      .sort((a, b) => b.deliveredOrders - a.deliveredOrders)
      .slice(0, 6);

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        merchantId: merchantId || null,
        from: range.from?.toISOString() || null,
        to: range.to?.toISOString() || null,
      },
      kpis: {
        totalOrders: orders.length,
        deliveredOrders: deliveredOrders.length,
        totalRevenue: revenue,
        pendingPayouts: heroPayouts,
        overdueInvoices: overdueInvoices.length,
      },
      exports: [
        { key: "orders", labelAr: "سجل الطلبات", count: orders.length, fileHint: "Excel / CSV" },
        { key: "payouts", labelAr: "مدفوعات الطيّارين", count: payouts.length, fileHint: "Excel / PDF" },
        { key: "invoices", labelAr: "فواتير التجار", count: invoices.length, fileHint: "Excel / PDF" },
      ],
      merchants: merchantRows,
      zones: zoneRows,
      heroes: heroRows,
      payoutQueue: payouts.map((payout) => ({
        id: payout.id,
        heroName: payout.hero.user.name,
        totalAmount: payout.totalAmount,
        baseSalary: payout.baseSalary,
        orderBonus: payout.orderBonus,
        penalties: payout.penalties,
        createdAt: payout.createdAt,
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        merchantName: invoice.brand.nameAr || invoice.brand.name,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        dueDate: invoice.dueDate,
      })),
    };
  });

  server.get("/reports/export/:key", async (request, reply) => {
    const { key } = request.params as { key: "orders" | "payouts" | "invoices" | "summary" };
    const format = ((request.query as { format?: "csv" | "json" }).format || "csv") as "csv" | "json";

    if (!["orders", "payouts", "invoices", "summary"].includes(key)) {
      throw new AppError(400, "REPORT_EXPORT_INVALID", "Unknown export key");
    }

    if (!["csv", "json"].includes(format)) {
      throw new AppError(400, "REPORT_EXPORT_FORMAT_INVALID", "Unsupported export format");
    }

    const exportFile = await buildAdminReportExport(key, format);

    reply.header("Content-Type", exportFile.contentType);
    reply.header("Content-Disposition", `attachment; filename=\"${exportFile.filename}\"`);
    return reply.send(exportFile.body);
  });
}
