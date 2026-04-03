"use client";

import { getApiBaseUrl } from "@tayyar/utils";

export type AppSessionRole = "ADMIN" | "SUPERVISOR" | "MERCHANT_OWNER" | "BRANCH_MANAGER" | "HERO";
export type AdminPermissionScope = "HEROES" | "FINANCE" | "USERS" | "MERCHANTS" | "BRANCHES" | "OPERATIONS" | "REPORTS" | "MAPS";

export type AppSessionUser = {
  id: string;
  email: string;
  name: string;
  role: AppSessionRole;
  adminScopes?: AdminPermissionScope[];
  phone?: string | null;
  language?: string;
};

export type AppSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AppSessionUser;
};

const STORAGE_KEY = "tayyar-auth-session";
const ACCESS_COOKIE_KEY = "tayyar_access_token";
const ROLE_COOKIE_KEY = "tayyar_user_role";

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getStoredSession(): AppSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AppSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(session: AppSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  setCookie(ACCESS_COOKIE_KEY, session.accessToken, session.expiresIn);
  setCookie(ROLE_COOKIE_KEY, session.user.role, session.expiresIn);
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  clearCookie(ACCESS_COOKIE_KEY);
  clearCookie(ROLE_COOKIE_KEY);
}

export async function signOutStoredSession() {
  const session = getStoredSession();

  try {
    if (session?.refreshToken) {
      await fetch(`${getApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)}/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }
  } finally {
    clearStoredSession();
  }
}

export function getHomePathForRole(role: AppSessionRole) {
  if (role === "ADMIN") return "/admin";
  if (role === "SUPERVISOR") return "/supervisor/map";
  if (role === "BRANCH_MANAGER") return "/branch/orders";
  if (role === "HERO") return "/hero";
  return "/merchant";
}
