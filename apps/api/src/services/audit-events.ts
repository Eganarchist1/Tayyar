import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

type RecordAuditEventInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

function toJsonValue(value?: Record<string, unknown> | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export async function recordAuditEvent(input: RecordAuditEventInput) {
  return prisma.auditEvent.create({
    data: {
      actorUserId: input.actorUserId || null,
      actorEmail: input.actorEmail || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: toJsonValue(input.summary),
      before: toJsonValue(input.before),
      after: toJsonValue(input.after),
    },
  });
}

export async function listAuditEvents(entityType: string, entityId: string, take = 20) {
  const rows = await prisma.auditEvent.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    actorUserId: row.actorUserId,
    actorEmail: row.actorEmail,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    before: row.before,
    after: row.after,
    createdAt: row.createdAt.toISOString(),
  }));
}
