import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import socketPlugin from "./plugins/socket";
import crmRoutes from "./merchants/crm";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Redis from "ioredis";
import { createReadStream } from "fs";
import { access } from "fs/promises";
import { podRoutes } from "./orders/pod";
import { env } from "./config";
import { AppError, normalizeError } from "./lib/errors";
import { prisma } from "./lib/prisma";
import { getWorkerLayerStatus, initializeWorkerLayer, shutdownWorkerLayer } from "./workers/queues";
import { getMimeTypeForUploadPath, resolveUploadDiskPath } from "./lib/uploads";

const server = Fastify({
  logger: true,
  requestIdHeader: "x-request-id",
});

// Configure plugins
server.register(helmet);
server.register(rateLimit, {
  max: env.API_RATE_LIMIT_MAX,
  timeWindow: "1 minute",
  skipOnError: true,
  allowList:
    env.NODE_ENV === "production"
      ? undefined
      : ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
});
server.register(cors, {
  origin:
    env.NODE_ENV === "production"
      ? [env.APP_BASE_URL, "https://tayyar.app"].filter((origin, index, list) => Boolean(origin) && list.indexOf(origin) === index)
      : true,
  allowedHeaders: ["Content-Type", "Authorization", "x-dev-role", "x-dev-email"],
  exposedHeaders: ["Content-Disposition", "Content-Type"],
});

server.register(jwt, {
  secret: env.JWT_SECRET,
});
server.register(multipart, {
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

server.addHook("preValidation", async (request) => {
  const contentType = String(request.headers["content-type"] || "");
  if (!contentType.includes("application/json")) {
    return;
  }

  let rawBody: string | null = null;
  if (typeof request.body === "string") {
    rawBody = request.body;
  } else if (Buffer.isBuffer(request.body)) {
    rawBody = request.body.toString("utf8");
  } else if (request.body instanceof Uint8Array) {
    rawBody = Buffer.from(request.body).toString("utf8");
  }

  if (rawBody === null) {
    return;
  }

  try {
    request.body = JSON.parse(rawBody);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed");
  }
});

server.addHook("onRequest", async (request, reply) => {
  reply.header("x-request-id", request.id);
});

server.register(socketPlugin);
server.register(crmRoutes);
server.register(podRoutes, { prefix: "/v1/orders" });

// Swagger Setup
server.register(swagger, {
  swagger: {
    info: {
      title: "Anti Gravity API",
      description: "Logistics and B2B Delivery Platform API",
      version: "1.0.0",
    },
    securityDefinitions: {
      bearerAuth: {
        type: "apiKey",
        name: "Authorization",
        in: "header",
      },
    },
  },
});

server.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "full",
    deepLinking: false,
  },
});

server.setErrorHandler((error, request, reply) => {
  const normalized = normalizeError(error);
  request.log.error(
    {
      err: error,
      code: normalized.body.code,
      path: request.url,
      method: request.method,
    },
    normalized.body.message,
  );
  reply.status(normalized.statusCode).send(normalized.body);
});

// Health check route
server.get("/health", async () => {
  return { status: "ok" };
});

server.get("/health/live", async () => {
  return { status: "ok", service: "tayyar-api" };
});

server.get("/health/ready", async (_request, reply) => {
  const checks = {
    database: { ok: false as boolean, message: "pending" },
    redis: { ok: false as boolean, message: env.REDIS_URL ? "pending" : "disabled" },
    workers: { ok: false as boolean, message: "pending" },
  };

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = { ok: true, message: "connected" };
  } catch (error) {
    checks.database = {
      ok: false,
      message: error instanceof Error ? error.message : "database check failed",
    };
  }

  if (env.REDIS_URL) {
    let redis: Redis | null = null;
    try {
      const redisUrl = new URL(env.REDIS_URL);
      redis = new Redis({
        host: redisUrl.hostname,
        port: redisUrl.port ? Number(redisUrl.port) : 6379,
        username: redisUrl.username || undefined,
        password: redisUrl.password || undefined,
        db: redisUrl.pathname && redisUrl.pathname !== "/" ? Number(redisUrl.pathname.slice(1)) : 0,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        connectTimeout: 2000,
      });
      await redis.connect();
      const pong = await redis.ping();
      checks.redis = { ok: pong === "PONG", message: pong };
    } catch (error) {
      checks.redis = {
        ok: false,
        message: error instanceof Error ? error.message : "redis check failed",
      };
    } finally {
      await redis?.quit().catch(() => undefined);
    }
  }

  const workerLayer = getWorkerLayerStatus();
  checks.workers = workerLayer.enabled
    ? {
        ok: workerLayer.initialized,
        message: workerLayer.initialized ? "ready" : "not initialized",
      }
    : {
        ok: true,
        message: "disabled",
      };

  const ready = checks.database.ok && checks.redis.ok && checks.workers.ok;
  if (!ready) {
    return reply.status(503).send({
      status: "degraded",
      checks,
      workerLayer,
    });
  }

  return {
    status: "ready",
    checks,
    workerLayer,
  };
});

server.get("/uploads/*", async (request, reply) => {
  const params = request.params as { "*": string };
  const relativePath = params["*"];

  if (!relativePath?.trim()) {
    throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
  }

  let filePath: string;
  try {
    filePath = resolveUploadDiskPath(env.UPLOADS_DIR, relativePath);
  } catch {
    throw new AppError(403, "UPLOAD_ACCESS_DENIED", "Upload access denied");
  }

  try {
    await access(filePath);
  } catch {
    throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
  }

  reply.header("cache-control", "public, max-age=86400, immutable");
  reply.type(getMimeTypeForUploadPath(filePath));
  return reply.send(createReadStream(filePath));
});

// Register routes
server.register(require("./auth/routes").default, { prefix: "/v1/auth" });
server.register(require("./admin/routes").default, { prefix: "/v1/admin" });
server.register(require("./supervisors/routes").default, { prefix: "/v1/supervisors" });
server.register(require("./merchants/routes").default, { prefix: "/v1/merchants" });
server.register(require("./heroes/routes").default, { prefix: "/v1/heroes" });
server.register(require("./webhooks/routes").default, { prefix: "/v1/webhooks" });
server.register(require("./billing/routes").default, { prefix: "/v1/billing" });

const start = async () => {
  try {
    await initializeWorkerLayer(server.log);
    server.addHook("onClose", async () => {
      await shutdownWorkerLayer();
    });
    await server.listen({ port: 3001, host: "0.0.0.0" });
    server.log.info({ url: "http://0.0.0.0:3001" }, "Tayyar API ready");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
