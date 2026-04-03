import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { normalizePhone, WhatsAppService } from "./whatsapp";

function requestView(request: Awaited<ReturnType<typeof getRequestRecord>>) {
  if (!request) {
    return null;
  }

  return {
    id: request.id,
    requestToken: request.requestToken,
    customerPhone: request.customerPhone,
    customerName: request.customerName,
    status: request.status,
    whatsappMessageId: request.whatsappMessageId,
    resolvedLat: request.resolvedLat,
    resolvedLng: request.resolvedLng,
    resolvedAddressLabel: request.resolvedAddressLabel,
    expiresAt: request.expiresAt,
    resolvedAt: request.resolvedAt,
    createdAt: request.createdAt,
    branch: {
      id: request.branch.id,
      name: request.branch.name,
      nameAr: request.branch.nameAr,
      whatsappNumber: request.branch.whatsappNumber,
    },
  };
}

async function getRequestRecord(id: string) {
  return prisma.customerLocationRequest.findUnique({
    where: { id },
    include: {
      branch: true,
    },
  });
}

export class CustomerLocationRequestService {
  static async create(params: {
    merchantId: string;
    branchId: string;
    customerPhone: string;
    customerName?: string;
    requestedByEmail?: string;
    merchantName: string;
    branchName: string;
  }) {
    const phone = normalizePhone(params.customerPhone);

    await prisma.customerLocationRequest.updateMany({
      where: {
        merchantId: params.merchantId,
        customerPhone: phone,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
      },
    });

    const request = await prisma.customerLocationRequest.create({
      data: {
        merchantId: params.merchantId,
        branchId: params.branchId,
        customerPhone: phone,
        customerName: params.customerName,
        requestedByEmail: params.requestedByEmail,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const message = await WhatsAppService.sendLocationRequest(phone, params.merchantName, params.branchName);

    const updated = await prisma.customerLocationRequest.update({
      where: { id: request.id },
      data: {
        whatsappMessageId: message.messageId,
      },
      include: {
        branch: true,
      },
    });

    return requestView(updated);
  }

  static async getLatestForMerchant(merchantId: string, customerPhone: string) {
    const phone = normalizePhone(customerPhone);
    const request = await prisma.customerLocationRequest.findFirst({
      where: {
        merchantId,
        customerPhone: phone,
      },
      include: {
        branch: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!request) {
      return null;
    }

    if (request.status === "PENDING" && request.expiresAt < new Date()) {
      const expired = await prisma.customerLocationRequest.update({
        where: { id: request.id },
        data: { status: "EXPIRED" },
        include: { branch: true },
      });
      return requestView(expired);
    }

    return requestView(request);
  }

  static async resolveFromWhatsapp(params: {
    customerPhone: string;
    lat: number;
    lng: number;
    addressLabel?: string;
    whatsappMessageId?: string;
  }) {
    const phone = normalizePhone(params.customerPhone);
    const request = await prisma.customerLocationRequest.findFirst({
      where: {
        customerPhone: phone,
        status: "PENDING",
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        branch: true,
        merchant: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!request) {
      return null;
    }

    const resolvedAddressLabel =
      params.addressLabel ||
      (request.branch.nameAr
        ? `موقع العميل - ${request.branch.nameAr}`
        : `Customer pin - ${request.branch.name}`);

    const [, updatedRequest] = await prisma.$transaction([
      prisma.customerAddressVault.upsert({
        where: {
          branchId_phone_lat_lng: {
            branchId: request.branchId,
            phone,
            lat: params.lat,
            lng: params.lng,
          },
        },
        update: {
          name: request.customerName,
          addressLabel: resolvedAddressLabel,
          waMessageId: params.whatsappMessageId,
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
        create: {
          branchId: request.branchId,
          phone,
          name: request.customerName,
          lat: params.lat,
          lng: params.lng,
          addressLabel: resolvedAddressLabel,
          waMessageId: params.whatsappMessageId,
        },
      }),
      prisma.customerLocationRequest.update({
        where: { id: request.id },
        data: {
          status: "RESOLVED",
          resolvedLat: params.lat,
          resolvedLng: params.lng,
          resolvedAddressLabel,
          resolvedAt: new Date(),
          whatsappMessageId: params.whatsappMessageId ?? request.whatsappMessageId,
        },
        include: {
          branch: true,
        },
      }),
    ]);

    return requestView(updatedRequest);
  }

  static async assertOwnedPendingRequest(merchantId: string, requestId: string) {
    const request = await prisma.customerLocationRequest.findFirst({
      where: {
        id: requestId,
        merchantId,
      },
      include: {
        branch: true,
      },
    });

    if (!request) {
      throw new AppError(404, "LOCATION_REQUEST_NOT_FOUND", "Customer location request not found");
    }

    return requestView(request);
  }
}

export { requestView };
