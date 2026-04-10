import { HeroStatus } from "@tayyar/db";
import { prisma } from "../lib/prisma";

export type HeroShiftMetrics = {
  totalKmToday: number;
  rideMinutesToday: number;
  checkInAt: string | null;
  checkOutAt: string | null;
  breakMinutesToday: number;
  onBreakSince: string | null;
};

function startOfDay(value = new Date()) {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day;
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
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

export async function getHeroShiftMetrics(heroIds: string[], now = new Date()) {
  if (!heroIds.length) {
    return new Map<string, HeroShiftMetrics>();
  }

  const todayStart = startOfDay(now);

  const [breadcrumbs, availabilityLogs, orders] = await Promise.all([
    prisma.breadcrumb.findMany({
      where: {
        heroId: { in: heroIds },
        createdAt: { gte: todayStart },
      },
      select: {
        heroId: true,
        lat: true,
        lng: true,
        createdAt: true,
      },
      orderBy: [{ heroId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.heroAvailabilityLog.findMany({
      where: {
        heroId: { in: heroIds },
        createdAt: { gte: todayStart },
      },
      select: {
        heroId: true,
        toStatus: true,
        createdAt: true,
      },
      orderBy: [{ heroId: "asc" }, { createdAt: "asc" }],
    }),
    prisma.order.findMany({
      where: {
        heroId: { in: heroIds },
        OR: [
          { pickedUpAt: { gte: todayStart } },
          { deliveredAt: { gte: todayStart } },
          { failedAt: { gte: todayStart } },
          {
            status: {
              in: ["ASSIGNED", "HERO_ACCEPTED", "PICKED_UP", "ON_WAY", "IN_TRANSIT", "ARRIVED"],
            },
          },
        ],
      },
      select: {
        heroId: true,
        status: true,
        assignedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        failedAt: true,
      },
      orderBy: [{ heroId: "asc" }, { requestedAt: "asc" }],
    }),
  ]);

  const metrics = new Map<string, HeroShiftMetrics>(
    heroIds.map((heroId) => [
      heroId,
      {
        totalKmToday: 0,
        rideMinutesToday: 0,
        checkInAt: null,
        checkOutAt: null,
        breakMinutesToday: 0,
        onBreakSince: null,
      },
    ]),
  );

  const breadcrumbsByHero = new Map<string, typeof breadcrumbs>();
  for (const point of breadcrumbs) {
    const group = breadcrumbsByHero.get(point.heroId) || [];
    group.push(point);
    breadcrumbsByHero.set(point.heroId, group);
  }

  for (const [heroId, points] of breadcrumbsByHero) {
    const heroMetrics = metrics.get(heroId);
    if (!heroMetrics || points.length < 2) {
      continue;
    }

    let distance = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      distance += calculateDistanceKm(previous.lat, previous.lng, current.lat, current.lng);
    }

    heroMetrics.totalKmToday = Number(distance.toFixed(2));
  }

  for (const order of orders) {
    if (!order.heroId) {
      continue;
    }
    const heroMetrics = metrics.get(order.heroId);
    if (!heroMetrics) {
      continue;
    }

    const rideStart = order.pickedUpAt || order.assignedAt;
    if (!rideStart) {
      continue;
    }

    const rideEnd = order.deliveredAt || order.failedAt || now;
    heroMetrics.rideMinutesToday += minutesBetween(rideStart, rideEnd);
  }

  const logsByHero = new Map<string, typeof availabilityLogs>();
  for (const log of availabilityLogs) {
    const group = logsByHero.get(log.heroId) || [];
    group.push(log);
    logsByHero.set(log.heroId, group);
  }

  for (const [heroId, logs] of logsByHero) {
    const heroMetrics = metrics.get(heroId);
    if (!heroMetrics) {
      continue;
    }

    let breakStartedAt: Date | null = null;

    for (const log of logs) {
      if (!heroMetrics.checkInAt && (log.toStatus === HeroStatus.ONLINE || log.toStatus === HeroStatus.ON_DELIVERY)) {
        heroMetrics.checkInAt = log.createdAt.toISOString();
      }

      if (log.toStatus === HeroStatus.OFFLINE) {
        heroMetrics.checkOutAt = log.createdAt.toISOString();
      }

      if (log.toStatus === HeroStatus.ON_BREAK) {
        breakStartedAt = log.createdAt;
        heroMetrics.onBreakSince = log.createdAt.toISOString();
        continue;
      }

      if (breakStartedAt) {
        heroMetrics.breakMinutesToday += minutesBetween(breakStartedAt, log.createdAt);
        breakStartedAt = null;
        heroMetrics.onBreakSince = null;
      }
    }

    if (breakStartedAt) {
      heroMetrics.breakMinutesToday += minutesBetween(breakStartedAt, now);
      heroMetrics.onBreakSince = breakStartedAt.toISOString();
    }
  }

  return metrics;
}
