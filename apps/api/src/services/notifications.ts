import nodemailer from "nodemailer";
import { env } from "../config";
import { WhatsAppService } from "./whatsapp";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const mailTransport =
  env.SMTP_HOST && env.SMTP_FROM
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: (env.SMTP_PORT || 587) === 465,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
              }
            : undefined,
      })
    : null;

async function sendMail(payload: MailPayload) {
  if (!mailTransport || !env.SMTP_FROM) {
    console.info("[tayyar:mail:skipped]", payload);
    return { skipped: true };
  }

  await mailTransport.sendMail({
    from: env.SMTP_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  return { skipped: false };
}

export const NotificationService = {
  async sendPasswordResetEmail(email: string, resetUrl: string) {
    return sendMail({
      to: email,
      subject: "Tayyar password reset",
      text: `Reset your Tayyar password using this link:\n${resetUrl}\n\nIf you did not request this change, ignore this message.`,
      html: `<p>Reset your Tayyar password using this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this change, ignore this message.</p>`,
    });
  },

  async sendActivationEmail(email: string, activationUrl: string) {
    return sendMail({
      to: email,
      subject: "Activate your Tayyar account",
      text: `Activate your Tayyar account using this link:\n${activationUrl}\n\nSet your password from that screen to start using the platform.`,
      html: `<p>Activate your Tayyar account using this link:</p><p><a href="${activationUrl}">${activationUrl}</a></p><p>Set your password from that screen to start using the platform.</p>`,
    });
  },

  async sendOtpCode(phone: string, code: string) {
    if (env.OTP_DELIVERY_MODE === "WHATSAPP") {
      const result = await WhatsAppService.sendMessage(
        phone,
        `Tayyar login code: ${code}\nThe code expires in 10 minutes.`,
      );
      if (!result.skipped) {
        return { channel: "whatsapp", skipped: false };
      }
    }

    console.info("[tayyar:otp]", { phone, code, mode: env.OTP_DELIVERY_MODE });
    return {
      channel: env.OTP_DELIVERY_MODE === "CONSOLE" ? "console" : "dev",
      skipped: env.OTP_DELIVERY_MODE === "DEV",
    };
  },

  transportStatus() {
    return {
      smtpConfigured: Boolean(mailTransport && env.SMTP_FROM),
      otpDeliveryMode: env.OTP_DELIVERY_MODE,
      whatsappConfigured: Boolean(env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    };
  },
};
