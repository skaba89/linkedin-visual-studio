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
      field: "email",
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
    const err = HttpError.validation("Email invalid", "VALIDATION_ERROR", {
      field: "email",
    });
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
      field: "email",
    });
    expect(err.toJSON()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Bad input",
        details: { field: "email" },
      },
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
