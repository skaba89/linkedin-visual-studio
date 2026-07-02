/**
 * HERMÈS — R-001 — Tests unitaires pour src/lib/http-error.ts
 *
 * (Tests for `session.ts` itself require extensive mocking of NextAuth +
 * Prisma, which is brittle; instead we cover the `HttpError` class which
 * is the building block for all session/ownership errors.)
 *
 * Couvre :
 *  - Constructeur : status, message, code, details
 *  - Factories : unauthorized, forbidden, notFound, validation, conflict, internal
 *  - toJSON : format de sérialisation attendu
 *  - isHttpError : type guard
 *
 * Run : npx vitest run src/lib/__tests__/http-error.test.ts
 */

import { describe, it, expect } from "vitest";
import { HttpError, isHttpError } from "@/lib/http-error";

describe("HttpError constructor", () => {
  it("stores status, message, code, details", () => {
    const err = new HttpError(422, "Bad input", "VALIDATION_ERROR", {
      details: { field: "email" },
    });
    expect(err.status).toBe(422);
    expect(err.message).toBe("Bad input");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({ field: "email" });
    expect(err.name).toBe("HttpError");
  });

  it("defaults code to INTERNAL_ERROR when not specified", () => {
    const err = new HttpError(500, "Oops");
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.details).toBeUndefined();
  });

  it("stores retryAfter from options (R-005)", () => {
    const err = new HttpError(429, "Slow down", "RATE_LIMITED", { retryAfter: 60 });
    expect(err.retryAfter).toBe(60);
  });

  it("preserves cause via Error chain (R-005)", () => {
    const cause = new Error("DB connection failed");
    const err = new HttpError(500, "Service unavailable", "INTERNAL_ERROR", { cause });
    expect((err as unknown as { cause?: unknown }).cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const err = new HttpError(404, "Not found");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
  });
});

describe("HttpError factories", () => {
  it("unauthorized() returns 401 with AUTH_REQUIRED code", () => {
    const err = HttpError.unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe("AUTH_REQUIRED");
  });

  it("forbidden() returns 403 with ADMIN_REQUIRED default code", () => {
    const err = HttpError.forbidden();
    expect(err.status).toBe(403);
    expect(err.code).toBe("ADMIN_REQUIRED");
  });

  it("notFound() returns 404 with NOT_FOUND code", () => {
    const err = HttpError.notFound();
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("validation() returns 422 with details", () => {
    const err = HttpError.validation("Email invalid", { field: "email" });
    expect(err.status).toBe(422);
    expect(err.details).toEqual({ field: "email" });
  });

  it("conflict() returns 409 with CONFLICT code", () => {
    const err = HttpError.conflict();
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("internal() returns 500 with INTERNAL_ERROR code", () => {
    const err = HttpError.internal();
    expect(err.status).toBe(500);
    expect(err.code).toBe("INTERNAL_ERROR");
  });

  // R-005 — new factories
  it("badRequest() returns 400 with BAD_REQUEST code", () => {
    const err = HttpError.badRequest();
    expect(err.status).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
  });

  it("methodNotAllowed() returns 405 with allowed methods in details", () => {
    const err = HttpError.methodNotAllowed("Use GET or POST", ["GET", "POST"]);
    expect(err.status).toBe(405);
    expect(err.code).toBe("METHOD_NOT_ALLOWED");
    expect(err.details).toEqual({ allowed: ["GET", "POST"] });
  });

  it("gone() returns 410 with GONE code", () => {
    const err = HttpError.gone();
    expect(err.status).toBe(410);
    expect(err.code).toBe("GONE");
  });

  it("payloadTooLarge() returns 413 with optional limit in details", () => {
    const err = HttpError.payloadTooLarge("File too big", 1048576);
    expect(err.status).toBe(413);
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
    expect(err.details).toEqual({ limit: 1048576 });
  });

  it("unsupportedMediaType() returns 415 with expected type in details", () => {
    const err = HttpError.unsupportedMediaType("Expected JSON", "application/json");
    expect(err.status).toBe(415);
    expect(err.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(err.details).toEqual({ expected: "application/json" });
  });

  it("tooManyRequests() returns 429 with retryAfter", () => {
    const err = HttpError.tooManyRequests("Slow down", 60);
    expect(err.status).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.retryAfter).toBe(60);
  });

  it("quotaExceeded() returns 429 with QUOTA_EXCEEDED code", () => {
    const err = HttpError.quotaExceeded("Daily quota hit");
    expect(err.status).toBe(429);
    expect(err.code).toBe("QUOTA_EXCEEDED");
  });

  it("badGateway() returns 502 with upstream in details", () => {
    const err = HttpError.badGateway("LinkedIn down", "linkedin-api");
    expect(err.status).toBe(502);
    expect(err.code).toBe("BAD_GATEWAY");
    expect(err.details).toEqual({ upstream: "linkedin-api" });
  });

  it("serviceUnavailable() returns 503 with retryAfter", () => {
    const err = HttpError.serviceUnavailable("Maintenance", 300);
    expect(err.status).toBe(503);
    expect(err.code).toBe("SERVICE_UNAVAILABLE");
    expect(err.retryAfter).toBe(300);
  });

  it("gatewayTimeout() returns 504", () => {
    const err = HttpError.gatewayTimeout();
    expect(err.status).toBe(504);
    expect(err.code).toBe("GATEWAY_TIMEOUT");
  });
});

describe("HttpError.toJSON", () => {
  it("serializes to { error: { code, message } } without details", () => {
    const err = new HttpError(401, "Unauthorized", "AUTH_REQUIRED");
    expect(err.toJSON()).toEqual({
      error: { code: "AUTH_REQUIRED", message: "Unauthorized" },
    });
  });

  it("includes details when present", () => {
    const err = new HttpError(422, "Bad input", "VALIDATION_ERROR", {
      details: { field: "email" },
    });
    expect(err.toJSON()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Bad input",
        details: { field: "email" },
      },
    });
  });

  it("includes retryAfter at the top level when present (R-005)", () => {
    const err = new HttpError(429, "Slow down", "RATE_LIMITED", { retryAfter: 60 });
    expect(err.toJSON()).toEqual({
      error: { code: "RATE_LIMITED", message: "Slow down" },
      retryAfter: 60,
    });
  });
});

describe("isHttpError type guard", () => {
  it("returns true for an HttpError instance", () => {
    expect(isHttpError(new HttpError(404, "Not found"))).toBe(true);
  });

  it("returns false for a generic Error", () => {
    expect(isHttpError(new Error("plain error"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isHttpError(null)).toBe(false);
    expect(isHttpError(undefined)).toBe(false);
    expect(isHttpError("string")).toBe(false);
    expect(isHttpError({ status: 404 })).toBe(false);
  });
});
