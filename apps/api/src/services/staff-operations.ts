import {
  HeroStatus,
  StaffCompensationMode,
  StaffCompensationTarget,
  VacationRequestStatus,
  VacationType,
} from "@tayyar/db";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function calculateVacationDays(startDate: Date, endDate: Date) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const diff = end.getTime() - start.getTime();

  if (diff < 0) {
    throw new AppError(400, "VACATION_RANGE_INVALID", "Vacation end date must be on or after the start date");
  }

  return Math.floor(diff / 86_400_000) + 1;
}

export async function getHeroHrDetailsByUserId(userId: string) {
  const hero = await prisma.heroProfile.findUnique({
    where: { userId },
    include: {
      user: true,
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
      vacationAllowances: {
        orderBy: { type: "asc" },
      },
      vacationRequests: {
        orderBy: { requestedAt: "desc" },
        take: 20,
        include: {
          decidedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!hero) {
    throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
  }

  const compensationProfile = await prisma.staffCompensationProfile.findUnique({
    where: { userId },
    include: {
      branch: {
        include: {
          brand: true,
        },
      },
    },
  });

  const activeAssignment = hero.assignments[0] || null;
  const fallbackBranch = compensationProfile?.branch || activeAssignment?.branch || null;
  const effectiveMode =
    compensationProfile?.mode ||
    fallbackBranch?.defaultHeroCompensationMode ||
    StaffCompensationMode.COMMISSION_ONLY;
  const effectiveBaseSalary =
    compensationProfile?.baseSalary ??
    fallbackBranch?.defaultHeroBaseSalary ??
    0;
  const effectiveCommission =
    compensationProfile?.commissionPerOrder ??
    fallbackBranch?.defaultHeroCommissionPerOrder ??
    0;

  const approvedVacation = hero.vacationRequests.find((request) => {
    if (request.status !== VacationRequestStatus.APPROVED) {
      return false;
    }

    const now = new Date();
    return startOfDay(request.startDate) <= now && endOfDay(request.endDate) >= now;
  });

  return {
    hero,
    activeAssignment,
    compensationProfile,
    effectiveCompensation: {
      mode: effectiveMode,
      baseSalary: effectiveBaseSalary,
      commissionPerOrder: effectiveCommission,
      branchId: fallbackBranch?.id || null,
      branchName: fallbackBranch?.name || null,
      branchNameAr: fallbackBranch?.nameAr || null,
      merchantName: fallbackBranch?.brand?.name || null,
      merchantNameAr: fallbackBranch?.brand?.nameAr || null,
      isActive: compensationProfile?.isActive ?? true,
      notes: compensationProfile?.notes || null,
      effectiveFrom: compensationProfile?.effectiveFrom?.toISOString() || null,
      effectiveTo: compensationProfile?.effectiveTo?.toISOString() || null,
    },
    vacationAllowances: hero.vacationAllowances.map((allowance) => ({
      id: allowance.id,
      type: allowance.type,
      totalDays: allowance.totalDays,
      usedDays: allowance.usedDays,
      remainingDays: Math.max(allowance.totalDays - allowance.usedDays, 0),
      notes: allowance.notes,
      isActive: allowance.isActive,
    })),
    vacationRequests: hero.vacationRequests.map((request) => ({
      id: request.id,
      type: request.type,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      requestedDays: request.requestedDays,
      status: request.status,
      reason: request.reason,
      decisionNote: request.decisionNote,
      requestedAt: request.requestedAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() || null,
      decidedBy: request.decidedBy
        ? {
            id: request.decidedBy.id,
            name: request.decidedBy.name,
            email: request.decidedBy.email,
          }
        : null,
    })),
    activeVacationRequest: approvedVacation
      ? {
          id: approvedVacation.id,
          type: approvedVacation.type,
          startDate: approvedVacation.startDate.toISOString(),
          endDate: approvedVacation.endDate.toISOString(),
          requestedDays: approvedVacation.requestedDays,
        }
      : null,
  };
}

export async function setHeroVacationAllowance(params: {
  userId: string;
  type: VacationType;
  totalDays: number;
  notes?: string | null;
  isActive?: boolean;
}) {
  const hero = await prisma.heroProfile.findUnique({
    where: { userId: params.userId },
    select: { id: true },
  });

  if (!hero) {
    throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
  }

  return prisma.heroVacationAllowance.upsert({
    where: {
      heroId_type: {
        heroId: hero.id,
        type: params.type,
      },
    },
    create: {
      heroId: hero.id,
      type: params.type,
      totalDays: params.totalDays,
      notes: params.notes?.trim() || null,
      isActive: params.isActive ?? true,
    },
    update: {
      totalDays: params.totalDays,
      notes: params.notes?.trim() || null,
      isActive: params.isActive ?? true,
    },
  });
}

export async function createHeroVacationRequest(params: {
  userId: string;
  type: VacationType;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
}) {
  const hero = await prisma.heroProfile.findUnique({
    where: { userId: params.userId },
    select: {
      id: true,
      status: true,
      vacationAllowances: {
        where: {
          type: params.type,
          isActive: true,
        },
        take: 1,
      },
    },
  });

  if (!hero) {
    throw new AppError(404, "HERO_NOT_FOUND", "Hero profile not found");
  }

  const requestedDays = calculateVacationDays(params.startDate, params.endDate);
  const allowance = hero.vacationAllowances[0];
  if (!allowance) {
    throw new AppError(409, "VACATION_ALLOWANCE_MISSING", "No active allowance is configured for this vacation type");
  }

  const remaining = allowance.totalDays - allowance.usedDays;
  if (remaining < requestedDays) {
    throw new AppError(409, "VACATION_ALLOWANCE_EXCEEDED", "Vacation balance is not enough for this request");
  }

  return prisma.heroVacationRequest.create({
    data: {
      heroId: hero.id,
      type: params.type,
      startDate: startOfDay(params.startDate),
      endDate: endOfDay(params.endDate),
      requestedDays,
      reason: params.reason?.trim() || null,
    },
  });
}

export async function decideHeroVacationRequest(params: {
  requestId: string;
  decidedById?: string | null;
  status: Exclude<VacationRequestStatus, "PENDING">;
  decisionNote?: string | null;
}) {
  const request = await prisma.heroVacationRequest.findUnique({
    where: { id: params.requestId },
    include: {
      hero: true,
    },
  });

  if (!request) {
    throw new AppError(404, "VACATION_REQUEST_NOT_FOUND", "Vacation request not found");
  }

  if (request.status !== VacationRequestStatus.PENDING) {
    throw new AppError(409, "VACATION_REQUEST_FINALIZED", "Vacation request has already been finalized");
  }

  return prisma.$transaction(async (tx) => {
    if (params.status === VacationRequestStatus.APPROVED) {
      const allowance = await tx.heroVacationAllowance.findUnique({
        where: {
          heroId_type: {
            heroId: request.heroId,
            type: request.type,
          },
        },
      });

      if (!allowance || !allowance.isActive) {
        throw new AppError(409, "VACATION_ALLOWANCE_MISSING", "No active allowance is configured for this vacation type");
      }

      const remaining = allowance.totalDays - allowance.usedDays;
      if (remaining < request.requestedDays) {
        throw new AppError(409, "VACATION_ALLOWANCE_EXCEEDED", "Vacation balance is not enough for this request");
      }

      await tx.heroVacationAllowance.update({
        where: { id: allowance.id },
        data: {
          usedDays: {
            increment: request.requestedDays,
          },
        },
      });

      const now = new Date();
      if (startOfDay(request.startDate) <= now && endOfDay(request.endDate) >= now) {
        await tx.heroProfile.update({
          where: { id: request.heroId },
          data: {
            status: HeroStatus.ON_BREAK,
          },
        });
      }
    }

    return tx.heroVacationRequest.update({
      where: { id: request.id },
      data: {
        status: params.status,
        decisionNote: params.decisionNote?.trim() || null,
        decidedAt: new Date(),
        decidedById: params.decidedById || null,
      },
    });
  });
}

export async function buildHeroCompensationSummary(userId: string) {
  const details = await getHeroHrDetailsByUserId(userId);
  const [delivered, pendingPayouts] = await Promise.all([
    prisma.order.aggregate({
      where: {
        heroId: details.hero.id,
        status: "DELIVERED",
      },
      _count: { id: true },
      _sum: {
        heroPayout: true,
      },
    }),
    prisma.payout.aggregate({
      where: {
        heroId: details.hero.id,
        status: "PENDING",
      },
      _sum: {
        totalAmount: true,
      },
    }),
  ]);

  return {
    heroId: details.hero.id,
    compensation: details.effectiveCompensation,
    totals: {
      deliveredOrders: delivered._count.id,
      accruedCommissions: delivered._sum.heroPayout || 0,
      pendingPayoutAmount: pendingPayouts._sum.totalAmount || 0,
      walletBalance: details.hero.walletBalance,
    },
  };
}
