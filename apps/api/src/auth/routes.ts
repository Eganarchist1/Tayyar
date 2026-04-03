import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors";
import { requireAuth } from "../decorators/auth";
import { AuthService } from "../services/auth";

function parseBody<T>(body: unknown, schema: z.ZodSchema<T>) {
  if (typeof body === "string") {
    try {
      return schema.parse(JSON.parse(body));
    } catch {
      throw new AppError(400, "VALIDATION_ERROR", "Request validation failed");
    }
  }

  return schema.parse(body);
}

function sessionMeta(request: { headers: Record<string, unknown>; ip: string }) {
  const userAgentHeader = request.headers["user-agent"];
  return {
    userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : String(userAgentHeader || ""),
    ipAddress: request.ip,
  };
}

export default async function authRoutes(server: FastifyInstance) {
  server.post("/login", async (request) => {
    const body = parseBody(request.body, z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }));

    return AuthService.loginWithPassword(server, body.email, body.password, sessionMeta(request));
  });

  server.post("/otp/request", async (request) => {
    const body = parseBody(request.body, z.object({
      phone: z.string().min(10),
      purpose: z.string().default("LOGIN"),
    }));

    return AuthService.requestOtp(body.phone, body.purpose);
  });

  server.post("/otp/verify", async (request) => {
    const body = parseBody(request.body, z.object({
      phone: z.string().min(10),
      code: z.string().length(4),
      purpose: z.string().default("LOGIN"),
    }));

    return AuthService.verifyOtp(server, body.phone, body.code, body.purpose, sessionMeta(request));
  });

  server.post("/refresh", async (request) => {
    const body = parseBody(request.body, z.object({
      refreshToken: z.string().min(24),
    }));

    return AuthService.refresh(server, body.refreshToken, sessionMeta(request));
  });

  server.post("/forgot-password", async (request) => {
    const body = parseBody(request.body, z.object({
      email: z.string().email(),
    }));

    return AuthService.requestPasswordReset(body.email);
  });

  server.post("/reset-password", async (request) => {
    const body = parseBody(request.body, z.object({
      token: z.string().min(24),
      password: z.string().min(8),
    }));

    return AuthService.resetPassword(server, body.token, body.password, sessionMeta(request));
  });

  server.post("/resend-activation", async (request) => {
    const body = parseBody(request.body, z.object({
      email: z.string().email(),
    }));

    return AuthService.resendActivation(body.email);
  });

  server.post("/activate", async (request) => {
    const body = parseBody(request.body, z.object({
      token: z.string().min(24),
      password: z.string().min(8),
    }));

    return AuthService.activateAccount(server, body.token, body.password, sessionMeta(request));
  });

  server.post("/change-password", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request.body, z.object({
      currentPassword: z.string().min(8),
      nextPassword: z.string().min(8),
    }));

    const user = request.user as { id?: string };
    if (!user.id) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }

    return AuthService.changePassword(
      server,
      user.id,
      body.currentPassword,
      body.nextPassword,
      sessionMeta(request),
    );
  });

  server.post("/logout", async (request) => {
    const body = parseBody(request.body || {}, z.object({
      refreshToken: z.string().optional(),
    }));

    return AuthService.logout(body.refreshToken || "");
  });

  server.get("/me", { preHandler: requireAuth }, async (request) => {
    const user = request.user as { id?: string };
    if (!user.id) {
      throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    }

    return AuthService.ensureUserActive(user.id);
  });
}
