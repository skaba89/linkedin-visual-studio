/**
 * HERMÈS — R-005/R-008 — Tests unitaires pour src/lib/api-handler.ts
 *
 * Couvre :
 *  - withApiHandler : succès avec X-Request-Id, HttpError sérialisé,
 *    Prisma P2002 → 409, P2025 → 404, ZodError → 422, erreur inconnue → 500,
 *    retryAfter header sur 429
 *  - generateRequestId : UUID v4 format
 *  - buildErrorResponse : headers + body corrects
 *
 * Run : npx vitest run src/lib/__tests__/api-handler.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  withApiHandler,
  generateRequestId,
} from "@/lib/api-handler";
import { HttpError } from "@/lib/http-error";

// ─── Helpers ────────────────────────────────────────────────────────

function makeReq(url = "https://example.com/api/test"): NextRequest {
  return new NextRequest(new URL(url), { method: "GET" });
}

// Stub console.error to avoid noisy output during error tests
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

// Stub the logger to avoid noisy output
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

beforeEach(() => {
  consoleErrorSpy.mockClear();
});

// ─── generateRequestId ──────────────────────────────────────────────

describe("generateRequestId", () => {
  it("produces a UUID v4 string", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("produces unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);
  });
});

// ─── withApiHandler — success path ─────────────────────────────────

describe("withApiHandler — success path", () => {
  it("returns the handler's response unchanged", async () => {
    const handler = vi.fn(async () => {
      return new Response("hello", { status: 200 });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello");
  });

  it("attaches X-Request-Id header to successful responses", async () => {
    const handler = vi.fn(async () => new Response("ok"));
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("passes requestId to the handler via ctx", async () => {
    const handler = vi.fn(async (_req, ctx) => {
      return Response.json({ requestId: ctx.requestId });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("awaits params Promise (App Router 15+)", async () => {
    const handler = vi.fn(async (_req, ctx) => {
      return Response.json({ id: ctx.params?.id });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), {
      params: Promise.resolve({ id: "abc123" }),
    });
    const body = await res.json();
    expect(body.id).toBe("abc123");
  });
});

// ─── withApiHandler — HttpError mapping ─────────────────────────────

describe("withApiHandler — HttpError handling", () => {
  it("serializes HttpError with the correct status and body", async () => {
    const handler = vi.fn(async () => {
      throw new HttpError(404, "Lead not found", "NOT_FOUND");
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "NOT_FOUND", message: "Lead not found" },
    });
  });

  it("includes details when present", async () => {
    const handler = vi.fn(async () => {
      throw HttpError.validation("Missing field", { fields: [{ path: "email", message: "required" }] });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.details).toEqual({
      fields: [{ path: "email", message: "required" }],
    });
  });

  it("sets Retry-After header when retryAfter is provided", async () => {
    const handler = vi.fn(async () => {
      throw HttpError.tooManyRequests("Slow down", 60);
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = await res.json();
    expect(body.retryAfter).toBe(60);
  });

  it("always sets X-Request-Id on error responses", async () => {
    const handler = vi.fn(async () => {
      throw HttpError.internal();
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

// ─── withApiHandler — Prisma error mapping ──────────────────────────

describe("withApiHandler — Prisma error mapping", () => {
  it("maps P2002 (unique constraint) to 409 CONFLICT", async () => {
    const handler = vi.fn(async () => {
      throw Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        clientVersion: "6.0.0",
        meta: { target: ["email"] },
      });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.details.prismaCode).toBe("P2002");
  });

  it("maps P2025 (record not found) to 404 NOT_FOUND", async () => {
    const handler = vi.fn(async () => {
      throw Object.assign(new Error("Record not found"), {
        code: "P2025",
        clientVersion: "6.0.0",
      });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("maps P2003 (FK constraint) to 409 CONFLICT", async () => {
    const handler = vi.fn(async () => {
      throw Object.assign(new Error("FK violation"), { code: "P2003" });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(409);
  });

  it("maps unknown Prisma codes to 500 INTERNAL_ERROR", async () => {
    const handler = vi.fn(async () => {
      throw Object.assign(new Error("Unknown Prisma error"), {
        code: "P9999",
      });
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
  });
});

// ─── withApiHandler — Zod error mapping ─────────────────────────────

describe("withApiHandler — Zod error mapping", () => {
  it("maps ZodError to 422 VALIDATION_ERROR with field details", async () => {
    const handler = vi.fn(async () => {
      throw {
        name: "ZodError",
        issues: [
          { path: ["email"], message: "Invalid email", code: "invalid_string" },
          { path: ["body", "name"], message: "Required", code: "invalid_type" },
        ],
      };
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.fields).toEqual([
      { path: "email", message: "Invalid email" },
      { path: "body.name", message: "Required" },
    ]);
  });
});

// ─── withApiHandler — unknown error fallback ────────────────────────

describe("withApiHandler — unknown error fallback", () => {
  it("maps any other error to 500 INTERNAL_ERROR", async () => {
    const handler = vi.fn(async () => {
      throw new Error("Unexpected bug");
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    // The error message is NOT leaked to the client (security best practice)
    expect(body.error.message).toBe("Internal server error");
  });

  it("handles non-Error throws (e.g. strings)", async () => {
    const handler = vi.fn(async () => {
      throw "string error";
    });
    const wrapped = withApiHandler(handler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
  });
});
