import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { FastifyInstance } from "fastify";
import { AdminPermissionScope, AuthActionTokenPurpose, UserRole } from "@tayyar/db";
import { env } from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { NotificationService } from "./notifications";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 * 8;
const REFRESH_TOKEN_TTL_DAYS = 30;
const OTP_TTL_MINUTES = 10;
const PASSWORD_RESET_TTL_MINUTES = 30;
const ACTIVATION_TTL_HOURS = 48;

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  adminScopes: AdminPermissionScope[];
  phone?: string | null;
  language: string;
  isActive: boolean;
};

type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

type AuthBundle = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.startsWith("20") && digits.length >= 11) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `+2${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+20${digits.replace(/^0/, "")}`;
  }

  return `+${digits}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, expectedHash] = stored.split(":");
  if (!salt || !expectedHash) {
    return false;
  }

  const candidateHash = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(candidateHash, "hex"));
}

function hashOtpCode(code: string) {
  return sha256(code);
}

function verifyOtpCode(code: string, storedHash: string) {
  const nextHash = hashOtpCode(code);
  return timingSafeEqual(Buffer.from(nextHash, "hex"), Buffer.from(storedHash, "hex"));
}

function generateOtpCode() {
  return randomInt(1000, 10000).toString();
}

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  adminScopes?: AdminPermissionScope[] | null;
  phone?: string | null;
  language?: string | null;
  isActive: boolean;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    adminScopes: user.adminScopes || [],
    phone: user.phone,
    language: user.language || "ar",
    isActive: user.isActive,
  };
}

async function issueSession(server: FastifyInstance, user: AuthUser, meta?: SessionMeta): Promise<AuthBundle> {
  const refreshToken = randomBytes(48).toString("base64url");
  const refreshTokenHash = sha256(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = server.jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      adminScopes: user.adminScopes,
      phone: user.phone,
      language: user.language,
    },
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user,
  };
}

export const AuthService = {
  hashPassword,
  normalizePhone,
  hashOtpCode,
  verifyOtpCode,
  generateOtpCode,

  async getUserById(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  async ensureUserActive(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new AppError(401, "UNAUTHORIZED", "This account is not active");
    }
    return sanitizeUser(user);
  },

  async loginWithPassword(server: FastifyInstance, email: string, password: string, meta?: SessionMeta) {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash) || !user.isActive) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    return issueSession(server, sanitizeUser(user), meta);
  },

  async requestOtp(phone: string, purpose = "LOGIN") {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      throw new AppError(400, "PHONE_REQUIRED", "Phone number is required");
    }

    const user = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError(404, "ACCOUNT_NOT_FOUND", "No active account was found for this phone number");
    }

    const code = generateOtpCode();
    await prisma.loginOtp.create({
      data: {
        userId: user.id,
        phone: normalizedPhone,
        purpose,
        codeHash: hashOtpCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
    });

    await NotificationService.sendOtpCode(normalizedPhone, code);

    return {
      sent: true,
      expiresInSeconds: OTP_TTL_MINUTES * 60,
      phone: normalizedPhone,
      devCode:
        env.OTP_DELIVERY_MODE === "WHATSAPP"
          ? undefined
          : code,
    };
  },

  async verifyOtp(server: FastifyInstance, phone: string, code: string, purpose = "LOGIN", meta?: SessionMeta) {
    const normalizedPhone = normalizePhone(phone);
    const normalizedCode = code.replace(/[^\d]/g, "");
    const otp = await prisma.loginOtp.findFirst({
      where: {
        phone: normalizedPhone,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    if (!otp || !otp.user || !otp.user.isActive) {
      throw new AppError(401, "INVALID_OTP", "The code is invalid or expired");
    }

    if (!verifyOtpCode(normalizedCode, otp.codeHash)) {
      throw new AppError(401, "INVALID_OTP", "The code is invalid or expired");
    }

    await prisma.loginOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    return issueSession(server, sanitizeUser(otp.user), meta);
  },

  async refresh(server: FastifyInstance, refreshToken: string, meta?: SessionMeta) {
    const session = await prisma.authSession.findUnique({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      throw new AppError(401, "INVALID_SESSION", "Session expired or invalid");
    }

    await prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return issueSession(server, sanitizeUser(session.user), meta);
  },

  async logout(refreshToken: string) {
    if (!refreshToken) {
      return { success: true };
    }

    const refreshTokenHash = sha256(refreshToken);
    await prisma.authSession.updateMany({
      where: {
        refreshTokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  },

  async changePassword(
    server: FastifyInstance,
    userId: string,
    currentPassword: string,
    nextPassword: string,
    meta?: SessionMeta,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash || !user.isActive) {
      throw new AppError(401, "UNAUTHORIZED", "This account is not active");
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashPassword(nextPassword) },
      }),
      prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    const freshUser = await this.ensureUserActive(userId);
    return issueSession(server, freshUser, meta);
  },

  async createActionToken(userId: string, purpose: AuthActionTokenPurpose) {
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt =
      purpose === AuthActionTokenPurpose.PASSWORD_RESET
        ? new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000)
        : new Date(Date.now() + ACTIVATION_TTL_HOURS * 60 * 60 * 1000);

    await prisma.authActionToken.create({
      data: {
        userId,
        purpose,
        tokenHash: sha256(rawToken),
        expiresAt,
      },
    });

    return {
      token: rawToken,
      expiresAt,
    };
  },

  async requestPasswordReset(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return {
        sent: true,
        expiresInSeconds: PASSWORD_RESET_TTL_MINUTES * 60,
      };
    }

    await prisma.authActionToken.updateMany({
      where: {
        userId: user.id,
        purpose: AuthActionTokenPurpose.PASSWORD_RESET,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const action = await this.createActionToken(
      user.id,
      AuthActionTokenPurpose.PASSWORD_RESET,
    );
    const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${action.token}`;
    await NotificationService.sendPasswordResetEmail(user.email, resetUrl);

    return {
      sent: true,
      expiresInSeconds: PASSWORD_RESET_TTL_MINUTES * 60,
      resetToken: process.env.NODE_ENV === "production" ? undefined : action.token,
      resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
    };
  },

  async resetPassword(server: FastifyInstance, token: string, password: string, meta?: SessionMeta) {
    const tokenRecord = await prisma.authActionToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.purpose !== AuthActionTokenPurpose.PASSWORD_RESET ||
      tokenRecord.consumedAt ||
      tokenRecord.expiresAt <= new Date() ||
      !tokenRecord.user.isActive
    ) {
      throw new AppError(400, "INVALID_RESET_TOKEN", "The reset link is invalid or expired");
    }

    const passwordHash = hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      }),
      prisma.authActionToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: new Date() },
      }),
      prisma.authSession.updateMany({
        where: {
          userId: tokenRecord.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    const freshUser = await this.ensureUserActive(tokenRecord.userId);
    return issueSession(server, freshUser, meta);
  },

  async resendActivation(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.isActive) {
      return {
        sent: true,
        expiresInSeconds: ACTIVATION_TTL_HOURS * 60 * 60,
      };
    }

    await prisma.authActionToken.updateMany({
      where: {
        userId: user.id,
        purpose: AuthActionTokenPurpose.ACCOUNT_ACTIVATION,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const action = await this.createActionToken(
      user.id,
      AuthActionTokenPurpose.ACCOUNT_ACTIVATION,
    );
    const activationUrl = `${env.APP_BASE_URL}/activate-account?token=${action.token}`;
    await NotificationService.sendActivationEmail(user.email, activationUrl);

    return {
      sent: true,
      expiresInSeconds: ACTIVATION_TTL_HOURS * 60 * 60,
      activationToken: process.env.NODE_ENV === "production" ? undefined : action.token,
      activationUrl: process.env.NODE_ENV === "production" ? undefined : activationUrl,
    };
  },

  async activateAccount(server: FastifyInstance, token: string, password: string, meta?: SessionMeta) {
    const tokenRecord = await prisma.authActionToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.purpose !== AuthActionTokenPurpose.ACCOUNT_ACTIVATION ||
      tokenRecord.consumedAt ||
      tokenRecord.expiresAt <= new Date()
    ) {
      throw new AppError(400, "INVALID_ACTIVATION_TOKEN", "The activation link is invalid or expired");
    }

    const passwordHash = hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash,
          isActive: true,
        },
      }),
      prisma.authActionToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    const freshUser = await this.ensureUserActive(tokenRecord.userId);
    return issueSession(server, freshUser, meta);
  },

  async inviteOrCreateUser(input: {
    name: string;
    email: string;
    role: UserRole;
    adminScopes?: AdminPermissionScope[];
    phone?: string | null;
    language?: string;
    password?: string;
  }) {
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        phone: input.phone ? normalizePhone(input.phone) : null,
        role: input.role,
        adminScopes: input.role === UserRole.ADMIN ? input.adminScopes || [] : [],
        language: input.language || "ar",
        passwordHash: input.password ? hashPassword(input.password) : null,
        isActive: Boolean(input.password),
      },
    });

    if (!input.password) {
      const action = await this.createActionToken(
        user.id,
        AuthActionTokenPurpose.ACCOUNT_ACTIVATION,
      );
      const activationUrl = `${env.APP_BASE_URL}/activate-account?token=${action.token}`;
      await NotificationService.sendActivationEmail(user.email, activationUrl);

      return {
        ...user,
        activationToken: process.env.NODE_ENV === "production" ? undefined : action.token,
        activationUrl: process.env.NODE_ENV === "production" ? undefined : activationUrl,
      };
    }

    return user;
  },
};
