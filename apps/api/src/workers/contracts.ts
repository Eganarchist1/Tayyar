export const queueNames = {
  assignment: "assignment",
  finance: "finance",
  efficiency: "efficiency",
  idleDetection: "idle-detection",
  invoiceGeneration: "invoice-generation",
  breadcrumbBatch: "breadcrumb-batch",
  otpDelivery: "otp-delivery",
  whatsappLocation: "whatsapp-location",
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export type AssignmentJobPayload = {
  orderId: string;
  source: "merchant_order" | "manual_reassign" | "retry";
};

export type FinanceJobPayload = {
  orderId: string;
  source: "pod_verify" | "reconcile";
};

export type OtpDeliveryJobPayload = {
  phone: string;
  purpose: string;
  code: string;
};

export type WhatsAppLocationJobPayload = {
  requestId: string;
  customerPhone: string;
};

export type BreadcrumbBatchJobPayload = {
  heroId: string;
  items: Array<{
    lat: number;
    lng: number;
    battery?: number;
    orderId?: string;
    reason?: "IDLE" | "MOVING_WITH_ORDER" | "MOVING_WITHOUT_ORDER";
    createdAt?: string;
  }>;
};

export type InvoiceGenerationJobPayload = {
  brandId: string;
  periodStart: string;
  periodEnd: string;
};

export type EfficiencyRefreshJobPayload = {
  heroId: string;
};

export type IdleDetectionJobPayload = {
  heroId: string;
  lastPingAt?: string;
};
