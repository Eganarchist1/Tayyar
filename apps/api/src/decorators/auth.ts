import { FastifyReply, FastifyRequest } from "fastify";
import { AdminPermissionScope, UserRole } from "@tayyar/db";
import { env } from "../config";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";

type DevUser = {
  id: string;
  role: UserRole;
  email: string;
  adminScopes?: AdminPermissionScope[];
};

function getDevUser(request: FastifyRequest): DevUser | null {
  if (!env.ALLOW_DEV_AUTH || env.NODE_ENV === "production" || !isLocalRequest(request)) {
    return null;
  }

  const authorizationHeader = request.headers.authorization;
  if (authorizationHeader && authorizationHeader.trim().toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const roleHeader = request.headers["x-dev-role"];
  const emailHeader = request.headers["x-dev-email"];
  const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
  const email = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader;

  return {
    id: "dev-user",
    role: (role as UserRole) || UserRole.MERCHANT_OWNER,
    email: email || "owner@merchant.com",
    adminScopes: [],
  };
}

function isLocalRequest(request: FastifyRequest) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const rawHost = request.headers.host || "";
  const origin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin || "";
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || request.ip || "";
  const host = rawHost.toLowerCase();
  const normalizedOrigin = origin.toLowerCase();

  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    normalizedOrigin.startsWith("http://localhost") ||
    normalizedOrigin.startsWith("http://127.0.0.1")
  );
}

async function resolveRequestUser(request: FastifyRequest) {
  const devUser = getDevUser(request);
  if (devUser) {
    (request as FastifyRequest & { user: DevUser }).user = devUser;
    return devUser;
  }

  await request.jwtVerify();
  const authUser = request.user as { id?: string };
  if (!authUser.id) {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      adminScopes: true,
      phone: true,
      language: true,
      isActive: true,
    },
  });

  if (!dbUser || !dbUser.isActive) {
    throw new AppError(401, "UNAUTHORIZED", "This account is not active");
  }

  (request as FastifyRequest & { user: typeof dbUser }).user = dbUser;
  return dbUser;
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    await resolveRequestUser(request);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  }
}

export function requireRole(roles: UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      const user = await resolveRequestUser(request);
      if (!roles.includes(user.role)) {
        throw new AppError(403, "FORBIDDEN", "Forbidden: insufficient permissions");
      }
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }
  };
}

export function hasAdminScope(
  user: { role?: UserRole; adminScopes?: AdminPermissionScope[] | null },
  scope: AdminPermissionScope,
) {
  if (user.role !== UserRole.ADMIN) {
    return false;
  }

  const scopes = user.adminScopes || [];
  return scopes.length === 0 || scopes.includes(scope);
}

export function requireAdminScope(scope: AdminPermissionScope) {
  return async (request: FastifyRequest) => {
    const user = request.user as { role?: UserRole; adminScopes?: AdminPermissionScope[] | null };
    if (!hasAdminScope(user, scope)) {
      throw new AppError(403, "FORBIDDEN", "Forbidden: insufficient admin scope");
    }
  };
}
