function normalizeBaseUrl(raw: string) {
  return raw.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
}

export type AppLocale = "ar" | "en";
export type AppDirection = "rtl" | "ltr";
export type LocalizedValue = {
  ar: string;
  en: string;
};

const localeTag: Record<AppLocale, string> = {
  ar: "ar-EG-u-nu-latn",
  en: "en-GB",
};

export function getDirection(locale: AppLocale): AppDirection {
  return locale === "ar" ? "rtl" : "ltr";
}

export function resolveLocalizedValue(
  value: string | LocalizedValue,
  locale: AppLocale,
) {
  if (typeof value === "string") {
    return value;
  }

  return locale === "ar" ? value.ar : value.en;
}

export function formatLocalizedNumber(
  value: number,
  locale: AppLocale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(localeTag[locale], options).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatLocalizedCurrency(
  value: number,
  locale: AppLocale,
  currency = "EGP",
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    ...options,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatLocalizedDateTime(
  value: string | Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(localeTag[locale], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatLocalizedDate(
  value: string | Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(localeTag[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(typeof value === "string" ? new Date(value) : value);
}

function shouldPreferLocalApi(configuredBaseUrl: string) {
  const pageHost =
    typeof window !== "undefined" && typeof window.location?.hostname === "string"
      ? window.location.hostname
      : null;

  if (!pageHost) {
    return false;
  }
  const localHosts = new Set(["localhost", "127.0.0.1"]);
  if (!localHosts.has(pageHost)) {
    return false;
  }

  try {
    const configuredHost = new URL(configuredBaseUrl).hostname;
    return !localHosts.has(configuredHost);
  } catch {
    return true;
  }
}

export function getApiBaseUrl(explicit?: string) {
  const raw =
    explicit ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.HERO_APP_API_URL ||
    "http://localhost:3001";

  const normalized = normalizeBaseUrl(raw);
  if (shouldPreferLocalApi(normalized)) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return normalized;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  baseUrl?: string,
): Promise<T> {
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${getApiBaseUrl(baseUrl)}${path}`, {
    headers: {
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as {
        code?: string;
        message?: string;
        details?: unknown;
        error?: string;
      };
      throw new ApiError(
        payload.message || payload.error || `Request failed with status ${response.status}`,
        response.status,
        payload.code,
        payload.details,
      );
    }

    const message = await response.text();
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}
