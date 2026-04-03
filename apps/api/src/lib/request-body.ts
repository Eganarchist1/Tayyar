import { AppError } from "./errors";

export function parseObjectBody<T extends Record<string, unknown> = Record<string, unknown>>(body: unknown): T {
  if (Buffer.isBuffer(body)) {
    body = body.toString("utf8");
  } else if (body instanceof Uint8Array) {
    body = Buffer.from(body).toString("utf8");
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new AppError(400, "VALIDATION_ERROR", "Request validation failed");
    }
  }

  if (!body || typeof body !== "object") {
    return {} as T;
  }

  return body as T;
}
