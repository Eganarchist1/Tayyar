import * as dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config();

const rawEnv = {
  ...process.env,
  WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN ?? process.env.WA_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? process.env.WA_PHONE_NUMBER_ID,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? process.env.WA_WEBHOOK_VERIFY_TOKEN,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET ?? process.env.WA_APP_SECRET,
  MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
  SMTP_PORT: process.env.SMTP_PORT ?? "587",
  OTP_DELIVERY_MODE: process.env.OTP_DELIVERY_MODE ?? (process.env.NODE_ENV === "production" ? "WHATSAPP" : "DEV"),
  APP_BASE_URL: process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  API_RATE_LIMIT_MAX:
    process.env.API_RATE_LIMIT_MAX ?? (process.env.NODE_ENV === "production" ? "100" : "2000"),
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"),
  MAX_UPLOAD_SIZE_MB: process.env.MAX_UPLOAD_SIZE_MB ?? "8",
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().transform(Number).default("3001"),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ALLOW_DEV_AUTH: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  REDIS_URL: z.string().url().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  OTP_DELIVERY_MODE: z.enum(["DEV", "CONSOLE", "WHATSAPP"]).default("DEV"),
  APP_BASE_URL: z.string().url(),
  API_RATE_LIMIT_MAX: z.string().transform(Number).default("100"),
  UPLOADS_DIR: z.string(),
  MAX_UPLOAD_SIZE_MB: z.string().transform(Number).default("8"),
});

const _env = envSchema.safeParse(rawEnv);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const env = _env.data;
