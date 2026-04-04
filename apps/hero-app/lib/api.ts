import { getApiBaseUrl } from "@tayyar/utils";
import { heroBuildConfig } from "./build-config";

export const heroApiBaseUrl = getApiBaseUrl(heroBuildConfig.apiUrl || "http://10.0.2.2:3001");

export const HERO_DEV_HEADERS = {
  "x-dev-role": "HERO",
  "x-dev-email": "hero@tayyar.app",
} as const;

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

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
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

export async function heroLogout(refreshToken?: string | null) {
  if (!refreshToken) {
    return;
  }

  await fetch(`${heroApiBaseUrl}/v1/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });
}
