import { getApiBaseUrl, apiFetch as baseApiFetch } from "@tayyar/utils";
import { clearStoredSession, getStoredSession, setStoredSession, type AppSession } from "./session";

export type DevRole = "MERCHANT_OWNER" | "ADMIN" | "SUPERVISOR" | "HERO" | "BRANCH_MANAGER";

export function getDevHeaders(
  role: DevRole = "MERCHANT_OWNER",
  email?: string,
) {
  const defaultEmails: Record<DevRole, string> = {
    MERCHANT_OWNER: "owner@merchant.com",
    ADMIN: "admin@tayyar.app",
    SUPERVISOR: "supervisor@tayyar.app",
    HERO: "hero@tayyar.app",
    BRANCH_MANAGER: "branch.manager@tayyar.app",
  };

  return {
    "x-dev-role": role,
    "x-dev-email": email || defaultEmails[role],
  };
}

export function apiFetch<T>(
  path: string,
  init?: RequestInit,
  role: DevRole = "MERCHANT_OWNER",
  email?: string,
) {
  return baseApiWithSession<T>(path, init, role, email);
}

export function resolveApiAssetUrl(path?: string | null) {
  if (!path) {
    return "";
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)}${normalizedPath}`;
}

export async function apiUpload<T>(
  path: string,
  body: FormData,
  role: DevRole = "MERCHANT_OWNER",
  email?: string,
) {
  const session = getStoredSession();
  const headers: Record<string, string> = {};

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  } else {
    Object.assign(headers, getDevHeaders(role, email));
  }

  const response = await fetch(`${getApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)}${path}`, {
    method: "POST",
    body,
    headers,
  });

  if (!response.ok) {
    let message = "Upload failed";
    try {
      const payload = await response.json();
      message = payload?.message || payload?.error || message;
    } catch {
      // Keep default message when the response is not JSON.
    }

    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}

export async function apiDownload(
  path: string,
  init?: RequestInit,
  role: DevRole = "MERCHANT_OWNER",
  email?: string,
) {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  } else {
    Object.assign(headers, getDevHeaders(role, email));
  }

  const response = await fetch(`${getApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = "Download failed";
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // Keep default message when the response is not JSON.
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i);

  return {
    blob,
    filename: match?.[1] || "download",
    contentType: response.headers.get("content-type") || blob.type,
  };
}

export function buildWebSocketUrl(path = "/v1/ws") {
  const baseUrl = getApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  const wsProtocol = baseUrl.startsWith("https://") ? "wss://" : "ws://";
  return `${baseUrl.replace(/^https?:\/\//, wsProtocol)}${path}`;
}

async function refreshSession(session: AppSession) {
  const refreshed = await baseApiFetch<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: AppSession["user"];
  }>("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  const nextSession: AppSession = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresIn: refreshed.expiresIn,
    user: refreshed.user,
  };
  setStoredSession(nextSession);
  return nextSession;
}

async function baseApiWithSession<T>(
  path: string,
  init?: RequestInit,
  role: DevRole = "MERCHANT_OWNER",
  email?: string,
): Promise<T> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  } else {
    Object.assign(headers, getDevHeaders(role, email));
  }

  try {
    return await baseApiFetch<T>(path, {
      ...init,
      headers,
    });
  } catch (error) {
    const isUnauthorized = error instanceof Error && "status" in error && (error as { status?: number }).status === 401;
    if (!isUnauthorized || !session?.refreshToken) {
      throw error;
    }

    try {
      const refreshed = await refreshSession(session);
      return await baseApiFetch<T>(path, {
        ...init,
        headers: {
          ...headers,
          Authorization: `Bearer ${refreshed.accessToken}`,
        },
      });
    } catch (refreshError) {
      clearStoredSession();
      throw refreshError;
    }
  }
}
