import type { FastifyBaseLogger } from "fastify";
import { Job, Queue, Worker, type ConnectionOptions } from "bullmq";
import { env } from "../config";
import { BillingService } from "../services/billing";
import { DispatcherService } from "../services/dispatcher";
import {
  type AssignmentJobPayload,
  type BreadcrumbBatchJobPayload,
  type EfficiencyRefreshJobPayload,
  type FinanceJobPayload,
  type IdleDetectionJobPayload,
  type InvoiceGenerationJobPayload,
  type OtpDeliveryJobPayload,
  type WhatsAppLocationJobPayload,
  queueNames,
} from "./contracts";

type QueueRegistry = {
  assignment: Queue;
  finance: Queue;
  efficiency: Queue;
  idleDetection: Queue;
  invoiceGeneration: Queue;
  breadcrumbBatch: Queue;
  otpDelivery: Queue;
  whatsappLocation: Queue;
  workers: Worker[];
};

let registry: QueueRegistry | null = null;

function getSharedConnection(): ConnectionOptions {
  const redisUrl = new URL(env.REDIS_URL!);
  return {
    host: redisUrl.hostname,
    port: redisUrl.port ? Number(redisUrl.port) : 6379,
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: redisUrl.pathname && redisUrl.pathname !== "/" ? Number(redisUrl.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

function buildQueue<T>(name: string, connection: ConnectionOptions) {
  return new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: 250,
      removeOnFail: 250,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1500,
      },
    },
  });
}

async function logNoopJob(logger: FastifyBaseLogger, job: Job<any, any, string>, label: string) {
  logger.info({ jobId: job.id, queue: job.queueName, data: job.data }, `${label} job processed`);
}

export async function initializeWorkerLayer(logger: FastifyBaseLogger) {
  if (!env.REDIS_URL) {
    logger.warn("Worker layer skipped because REDIS_URL is not configured");
    return null;
  }

  if (registry) {
    return registry;
  }

  const connection = getSharedConnection();
  const assignment = buildQueue<AssignmentJobPayload>(queueNames.assignment, connection);
  const finance = buildQueue<FinanceJobPayload>(queueNames.finance, connection);
  const efficiency = buildQueue<EfficiencyRefreshJobPayload>(queueNames.efficiency, connection);
  const idleDetection = buildQueue<IdleDetectionJobPayload>(queueNames.idleDetection, connection);
  const invoiceGeneration = buildQueue<InvoiceGenerationJobPayload>(queueNames.invoiceGeneration, connection);
  const breadcrumbBatch = buildQueue<BreadcrumbBatchJobPayload>(queueNames.breadcrumbBatch, connection);
  const otpDelivery = buildQueue<OtpDeliveryJobPayload>(queueNames.otpDelivery, connection);
  const whatsappLocation = buildQueue<WhatsAppLocationJobPayload>(queueNames.whatsappLocation, connection);

  const workers = [
    new Worker<AssignmentJobPayload>(
      queueNames.assignment,
      async (job) => {
        await DispatcherService.autoAssign(job.data.orderId, logger);
      },
      { connection, concurrency: 4 },
    ),
    new Worker<FinanceJobPayload>(
      queueNames.finance,
      async (job) => {
        await BillingService.processOrderCompletion(job.data.orderId);
      },
      { connection, concurrency: 2 },
    ),
    new Worker<EfficiencyRefreshJobPayload>(
      queueNames.efficiency,
      async (job) => logNoopJob(logger, job, "Efficiency refresh"),
      { connection },
    ),
    new Worker<IdleDetectionJobPayload>(
      queueNames.idleDetection,
      async (job) => logNoopJob(logger, job, "Idle detection"),
      { connection },
    ),
    new Worker<InvoiceGenerationJobPayload>(
      queueNames.invoiceGeneration,
      async (job) => logNoopJob(logger, job, "Invoice generation"),
      { connection },
    ),
    new Worker<BreadcrumbBatchJobPayload>(
      queueNames.breadcrumbBatch,
      async (job) => logNoopJob(logger, job, "Breadcrumb batch"),
      { connection, concurrency: 4 },
    ),
    new Worker<OtpDeliveryJobPayload>(
      queueNames.otpDelivery,
      async (job) => logNoopJob(logger, job, "OTP delivery"),
      { connection, concurrency: 4 },
    ),
    new Worker<WhatsAppLocationJobPayload>(
      queueNames.whatsappLocation,
      async (job) => logNoopJob(logger, job, "WhatsApp location"),
      { connection, concurrency: 2 },
    ),
  ];

  for (const worker of workers) {
    worker.on("failed", (job, error) => {
      logger.error({ err: error, jobId: job?.id, queue: job?.queueName }, "Worker job failed");
    });
  }

  registry = {
    assignment,
    finance,
    efficiency,
    idleDetection,
    invoiceGeneration,
    breadcrumbBatch,
    otpDelivery,
    whatsappLocation,
    workers,
  };

  logger.info({ queues: Object.values(queueNames) }, "Worker layer initialized");
  return registry;
}

export async function shutdownWorkerLayer() {
  if (!registry) {
    return;
  }

  await Promise.all(registry.workers.map((worker) => worker.close()));
  await Promise.all([
    registry.assignment.close(),
    registry.finance.close(),
    registry.efficiency.close(),
    registry.idleDetection.close(),
    registry.invoiceGeneration.close(),
    registry.breadcrumbBatch.close(),
    registry.otpDelivery.close(),
    registry.whatsappLocation.close(),
  ]);
  registry = null;
}

export function getWorkerLayerStatus() {
  return {
    enabled: Boolean(env.REDIS_URL),
    initialized: Boolean(registry),
    queues: registry ? Object.values(queueNames) : [],
  };
}

export async function enqueueAssignmentJob(payload: AssignmentJobPayload, logger?: FastifyBaseLogger) {
  if (!registry) {
    logger?.warn({ payload }, "Assignment queue unavailable, falling back to direct dispatch");
    await DispatcherService.autoAssign(payload.orderId, logger);
    return;
  }

  await registry.assignment.add("dispatch", payload);
}

export async function enqueueFinanceJob(payload: FinanceJobPayload, logger?: FastifyBaseLogger) {
  if (!registry) {
    logger?.warn({ payload }, "Finance queue unavailable, falling back to direct settlement");
    await BillingService.processOrderCompletion(payload.orderId);
    return;
  }

  await registry.finance.add("settlement", payload);
}
