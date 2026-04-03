import {
  AdminPermissionScope,
  BloodType,
  HeroStatus,
  HeroVerificationStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from "@tayyar/db";
import { AuthService } from "./auth";

export type ManagedUserInput = {
  existingUserId?: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  language?: string;
  password?: string;
  defaultPasswordIfMissing?: string | null;
  isActive?: boolean;
  avatarUrl?: string | null;
  adminScopes?: AdminPermissionScope[];
};

export type ManagedHeroInput = ManagedUserInput & {
  zoneId?: string | null;
  status?: HeroStatus | null;
  nationalId?: string | null;
  nationalIdFrontUrl?: string | null;
  nationalIdBackUrl?: string | null;
  licenseUrl?: string | null;
  bloodType?: BloodType | null;
  verificationStatus?: HeroVerificationStatus | null;
  verificationNote?: string | null;
};

function normalizePhone(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return AuthService.normalizePhone(value) || null;
}

export function normalizeAdminScopes(input?: unknown) {
  if (!Array.isArray(input)) {
    return [] as AdminPermissionScope[];
  }

  const allowed = new Set(Object.values(AdminPermissionScope));
  return input
    .map((value) => String(value).trim().toUpperCase())
    .filter((value): value is AdminPermissionScope => allowed.has(value as AdminPermissionScope));
}

type TxClient = Prisma.TransactionClient | PrismaClient;

export async function syncManagedUser(
  tx: TxClient,
  input: ManagedUserInput,
) {
  const resolvedScopes = input.role === UserRole.ADMIN ? normalizeAdminScopes(input.adminScopes) : [];
  const updateData: Prisma.UserUncheckedUpdateInput = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    role: input.role,
    language: input.language || "ar",
    avatarUrl: input.avatarUrl?.trim() || null,
    isActive: input.isActive ?? true,
    adminScopes: resolvedScopes,
    passwordHash: input.password ? AuthService.hashPassword(input.password) : undefined,
  };

  if (input.existingUserId) {
    return tx.user.update({
      where: { id: input.existingUserId },
      data: updateData,
    });
  }

  const resolvedPassword = input.password || input.defaultPasswordIfMissing || null;
  const createData: Prisma.UserUncheckedCreateInput = {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    role: input.role,
    language: input.language || "ar",
    avatarUrl: input.avatarUrl?.trim() || null,
    isActive: input.isActive ?? Boolean(resolvedPassword),
    adminScopes: resolvedScopes,
    passwordHash: resolvedPassword ? AuthService.hashPassword(resolvedPassword) : null,
  };

  return tx.user.create({
    data: createData,
  });
}

export async function syncHeroProfile(
  tx: TxClient,
  userId: string,
  input: Omit<ManagedHeroInput, keyof ManagedUserInput>,
) {
  const existing = await tx.heroProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  const payload: Prisma.HeroProfileUncheckedCreateInput | Prisma.HeroProfileUncheckedUpdateInput = {
    userId,
    zoneId: input.zoneId === undefined ? undefined : input.zoneId || null,
    status: input.status || HeroStatus.OFFLINE,
    nationalId: input.nationalId === undefined ? undefined : input.nationalId?.trim() || null,
    nationalIdFrontUrl:
      input.nationalIdFrontUrl === undefined ? undefined : input.nationalIdFrontUrl?.trim() || null,
    nationalIdBackUrl:
      input.nationalIdBackUrl === undefined ? undefined : input.nationalIdBackUrl?.trim() || null,
    licenseUrl: input.licenseUrl === undefined ? undefined : input.licenseUrl?.trim() || null,
    bloodType: input.bloodType ?? BloodType.UNKNOWN,
    verificationStatus: input.verificationStatus ?? HeroVerificationStatus.PENDING,
    verificationNote: input.verificationNote === undefined ? undefined : input.verificationNote?.trim() || null,
    isVerified: (input.verificationStatus ?? HeroVerificationStatus.PENDING) === HeroVerificationStatus.APPROVED,
  };

  if (existing) {
    return tx.heroProfile.update({
      where: { userId },
      data: payload,
    });
  }

  return tx.heroProfile.create({
    data: payload as Prisma.HeroProfileUncheckedCreateInput,
  });
}

export async function syncManagedHero(
  tx: TxClient,
  input: ManagedHeroInput,
) {
  const user = await syncManagedUser(tx, {
    existingUserId: input.existingUserId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: UserRole.HERO,
    language: input.language,
    password: input.password,
    defaultPasswordIfMissing: "Tayyar@123",
    isActive: input.isActive,
    avatarUrl: input.avatarUrl,
  });

  await syncHeroProfile(tx, user.id, {
    zoneId: input.zoneId,
    status: input.status ?? HeroStatus.OFFLINE,
    nationalId: input.nationalId,
    nationalIdFrontUrl: input.nationalIdFrontUrl,
    nationalIdBackUrl: input.nationalIdBackUrl,
    licenseUrl: input.licenseUrl,
    bloodType: input.bloodType ?? BloodType.UNKNOWN,
    verificationStatus: input.verificationStatus ?? HeroVerificationStatus.PENDING,
    verificationNote: input.verificationNote,
  });

  return tx.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      heroProfile: {
        include: {
          zone: true,
          assignments: {
            where: { isActive: true },
            include: {
              branch: {
                include: { brand: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
}
