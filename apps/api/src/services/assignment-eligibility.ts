import { prisma } from "../lib/prisma";
import { VacationRequestStatus } from "@tayyar/db";

const ACTIVE_DELIVERY_ORDER_STATUSES = [
  "ASSIGNED",
  "HERO_ACCEPTED",
  "PICKED_UP",
  "ON_WAY",
  "IN_TRANSIT",
  "ARRIVED",
] as const;

const MAX_ACTIVE_ORDERS_PER_HERO = 2;

export type EligibleHeroOption = {
  heroId: string;
  userId: string;
  name: string;
  phone: string | null;
  status: string;
  zoneId: string | null;
  zoneName: string | null;
  zoneNameAr: string | null;
  distanceKm: number;
  activeOrders: number;
  ordersToday: number;
  assignmentReason: "DEDICATED_BRANCH" | "NEAREST_IN_ZONE";
};

export type EligibleHeroViewModel = {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  status: string;
  distanceKm: number;
  activeOrders: number;
  ordersToday: number;
  assignmentReason: "DEDICATED_BRANCH" | "NEAREST_IN_ZONE";
  zone: {
    id: string | null;
    name: string | null;
    nameAr: string | null;
  };
};

export function buildEligibleHeroViewModel(hero: EligibleHeroOption): EligibleHeroViewModel {
  return {
    id: hero.heroId,
    userId: hero.userId,
    name: hero.name,
    phone: hero.phone,
    status: hero.status,
    distanceKm: hero.distanceKm,
    activeOrders: hero.activeOrders,
    ordersToday: hero.ordersToday,
    assignmentReason: hero.assignmentReason,
    zone: {
      id: hero.zoneId,
      name: hero.zoneName,
      nameAr: hero.zoneNameAr,
    },
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export async function listEligibleHeroesForOrder(orderId: string, scopeZoneIds?: string[]) {
  const now = new Date();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      branch: {
        include: {
          brand: true,
        },
      },
      zone: true,
    },
  });

  if (!order) {
    return { order: null, eligibleHeroes: [] as EligibleHeroOption[] };
  }

  if (scopeZoneIds?.length && order.zoneId && !scopeZoneIds.includes(order.zoneId)) {
    return { order, eligibleHeroes: [] as EligibleHeroOption[] };
  }

  const dedicatedAssignments = await prisma.heroAssignment.findMany({
    where: {
      branchId: order.branchId,
      isActive: true,
      model: "DEDICATED",
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    select: {
      heroId: true,
    },
  });

  const dedicatedHeroIds = dedicatedAssignments.map((assignment) => assignment.heroId);

  const heroes = await prisma.heroProfile.findMany({
    where: {
      user: {
        is: {
          isActive: true,
        },
      },
      isVerified: true,
      verificationStatus: "APPROVED",
      status: {
        in: ["ONLINE", "ON_DELIVERY"],
      },
      vacationRequests: {
        none: {
          status: VacationRequestStatus.APPROVED,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      OR: [
        dedicatedHeroIds.length ? { id: { in: dedicatedHeroIds } } : undefined,
        order.zoneId
          ? {
              zoneId: order.zoneId,
              assignments: {
                none: {
                  isActive: true,
                  model: "DEDICATED",
                  startDate: { lte: now },
                  OR: [{ endDate: null }, { endDate: { gte: now } }],
                },
              },
            }
          : undefined,
      ].filter(Boolean) as any,
    },
    include: {
      user: true,
      zone: true,
    },
  });

  if (!heroes.length) {
    return { order, eligibleHeroes: [] as EligibleHeroOption[] };
  }

  const workloadRows = await prisma.order.groupBy({
    by: ["heroId"],
    where: {
      heroId: {
        in: heroes.map((hero) => hero.id),
      },
      status: {
        in: ACTIVE_DELIVERY_ORDER_STATUSES as unknown as Array<any>,
      },
    },
    _count: {
      heroId: true,
    },
  });

  const activeOrdersByHero = new Map(
    workloadRows.map((row) => [row.heroId || "", row._count.heroId]),
  );

  const eligibleHeroes = heroes
    .map((hero) => {
      const activeOrders = activeOrdersByHero.get(hero.id) || 0;
      const dedicated = dedicatedHeroIds.includes(hero.id);
      const pickupDistance =
        hero.currentLat !== null && hero.currentLng !== null
          ? calculateDistance(order.pickupLat, order.pickupLng, hero.currentLat, hero.currentLng)
          : Number.POSITIVE_INFINITY;

      return {
        heroId: hero.id,
        userId: hero.userId,
        name: hero.user.name,
        phone: hero.user.phone,
        status: hero.status,
        zoneId: hero.zoneId,
        zoneName: hero.zone?.name || null,
        zoneNameAr: hero.zone?.nameAr || null,
        distanceKm: pickupDistance,
        activeOrders,
        ordersToday: hero.ordersToday,
        assignmentReason: dedicated ? ("DEDICATED_BRANCH" as const) : ("NEAREST_IN_ZONE" as const),
        dedicated,
      };
    })
    .filter((hero) => hero.activeOrders < MAX_ACTIVE_ORDERS_PER_HERO)
    .sort((left, right) => {
      if (left.dedicated !== right.dedicated) {
        return left.dedicated ? -1 : 1;
      }
      if (Number.isFinite(left.distanceKm) !== Number.isFinite(right.distanceKm)) {
        return Number.isFinite(left.distanceKm) ? -1 : 1;
      }
      if (Math.abs(left.distanceKm - right.distanceKm) > 0.05) {
        return left.distanceKm - right.distanceKm;
      }
      if (left.activeOrders !== right.activeOrders) {
        return left.activeOrders - right.activeOrders;
      }
      return left.ordersToday - right.ordersToday;
    })
    .map(({ dedicated, ...hero }) => hero);

  return { order, eligibleHeroes };
}

export async function assertHeroEligibleForOrder(orderId: string, heroId: string, scopeZoneIds?: string[]) {
  const { order, eligibleHeroes } = await listEligibleHeroesForOrder(orderId, scopeZoneIds);
  if (!order) {
    return { order: null, hero: null, eligibleHeroes };
  }

  const hero = eligibleHeroes.find((entry) => entry.heroId === heroId);
  return { order, hero: hero || null, eligibleHeroes };
}
