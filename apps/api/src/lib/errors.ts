import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function normalizeError(error: unknown) {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    (error as { statusCode?: unknown }).statusCode === 429
  ) {
    const rateLimitError = error as { message?: string; headers?: unknown };
    return {
      statusCode: 429,
      body: {
        code: "RATE_LIMITED",
        message: rateLimitError.message || "Too many requests",
        details: rateLimitError.headers,
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.flatten(),
      },
    };
  }

  if (error instanceof Error) {
    return {
      statusCode: 500,
      body: {
        code: "INTERNAL_ERROR",
        message: error.message || "Unexpected server error",
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
    },
  };
}
