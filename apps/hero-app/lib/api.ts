import { getApiBaseUrl } from "@tayyar/utils";
import { heroBuildConfig } from "./build-config";

export const heroApiBaseUrl = getApiBaseUrl(heroBuildConfig.apiUrl || "http://10.0.2.2:3001");

export const HERO_DEV_HEADERS = {
  "x-dev-role": "HERO",
  "x-dev-email": "hero@tayyar.app",
} as const;

export class HeroApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = "HeroApiError";
    this.code = options?.code;
    this.status = options?.status;
  }
}

export async function heroFetch<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    Object.assign(headers, HERO_DEV_HEADERS);
  }

  const response = await fetch(`${heroApiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    let code: string | undefined;

    if (contentType.includes("application/json")) {
      try {
        const body = (await response.json()) as { message?: string; code?: string };
        message = body.message || message;
        code = body.code;
      } catch {
        // Ignore malformed JSON error payloads.
      }
    } else {
      try {
        const text = await response.text();
        if (text) message = text;
      } catch {
        // Ignore text parse failures.
      }
    }

    throw new HeroApiError(message, { code, status: response.status });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
}

export function isRetryableHeroError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("load failed") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("temporarily unavailable")
  );
}

export function isMissingHeroAccountError(error: unknown) {
  return error instanceof HeroApiError && error.code === "ACCOUNT_NOT_FOUND";
}

export function isInvalidOtpError(error: unknown) {
  return error instanceof HeroApiError && error.code === "INVALID_OTP";
}

export async function heroLogout(refreshToken?: string | null) {
  if (!refreshToken) return;

  await fetch(`${heroApiBaseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });
}
