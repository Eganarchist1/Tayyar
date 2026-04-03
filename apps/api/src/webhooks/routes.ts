import crypto from "crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { env } from "../config";
import { CustomerLocationRequestService } from "../services/location-requests";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyWebhookSignature(body: unknown, signatureHeader?: string) {
  if (!env.WHATSAPP_APP_SECRET) {
    return true;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac("sha256", env.WHATSAPP_APP_SECRET)
    .update(JSON.stringify(body))
    .digest("hex")}`;

  return safeEqual(expected, signatureHeader);
}

export default async function webhookRoutes(server: FastifyInstance) {
  server.get("/whatsapp", async (request, reply) => {
    const hub = request.query as { "hub.challenge"?: string; "hub.verify_token"?: string };

    if (
      env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
      hub["hub.verify_token"] === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    ) {
      return hub["hub.challenge"];
    }

    return reply.status(403).send("Forbidden");
  });

  server.post("/whatsapp", async (request, reply) => {
    const body = request.body as any;
    const signature = request.headers["x-hub-signature-256"];

    if (!verifyWebhookSignature(body, Array.isArray(signature) ? signature[0] : signature)) {
      request.log.warn("Rejected WhatsApp webhook with invalid signature");
      return reply.status(401).send({ received: false });
    }

    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message) {
        return { received: true };
      }

      const from = message.from as string;
      const messageId = message.id as string | undefined;

      if (message.type === "location") {
        const { latitude, longitude, name, address } = message.location || {};

        const resolvedRequest = await CustomerLocationRequestService.resolveFromWhatsapp({
          customerPhone: from,
          lat: latitude,
          lng: longitude,
          addressLabel: address || name,
          whatsappMessageId: messageId,
        });

        if (resolvedRequest) {
          server.broadcast(
            "MERCHANT_LOCATION_REQUEST_UPDATE",
            {
              phone: resolvedRequest.customerPhone,
              request: resolvedRequest,
            },
            { channels: [`merchant-location-request:${resolvedRequest.customerPhone}`] },
          );

          request.log.info(
            {
              phone: from,
              requestId: resolvedRequest.id,
              lat: latitude,
              lng: longitude,
            },
            "Resolved customer location request from WhatsApp webhook",
          );

          return { received: true };
        }

        const hero = await prisma.user.findUnique({
          where: { phone: from },
          include: { heroProfile: true },
        });

        if (hero?.heroProfile) {
          await prisma.heroProfile.update({
            where: { id: hero.heroProfile.id },
            data: {
              currentLat: latitude,
              currentLng: longitude,
              lastPingAt: new Date(),
            },
          });
        }
      }

      if (message.type === "text" || message.type === "button") {
        const text = (message.text?.body || message.button?.text || "").toLowerCase();

        if (text.includes("login") || text.includes("دخول") || text.includes("طيار")) {
          const hero = await prisma.user.findFirst({
            where: { phone: from, role: "HERO" },
          });

          const { WhatsAppService } = await import("../services/whatsapp");

          if (hero) {
            const token = server.jwt.sign(
              { id: hero.id, role: hero.role, email: hero.email },
              { expiresIn: "365d" },
            );

            await WhatsAppService.sendLoginLink(from, token);
          } else {
            await WhatsAppService.sendMessage(
              from,
              "الرقم ده مش متسجل كطيار في النظام. كلم المشرف المسؤول علشان يساعدك.",
            );
          }
        }
      }

      return { received: true };
    } catch (error) {
      request.log.error({ err: error }, "WhatsApp webhook processing failed");
      return { received: true };
    }
  });
}
