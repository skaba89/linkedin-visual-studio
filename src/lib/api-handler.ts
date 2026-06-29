/**
 * HERMÈS — R-008 — Global API error handler
 *
 * `withApiHandler()` is a higher-order function that wraps a Next.js API
 * route handler and centralizes error handling. Routes no longer need to
 * write `try/catch { if (isHttpError(err)) ...; throw err; }` boilerplate.
 *
 * Error mapping:
 *  - HttpError         → JSON response with `err.status` and `err.toJSON()` body
 *  - Prisma errors     → mapped to 4xx (P2002 unique → 409, P2025 not found → 404)
 *  - Zod errors        → 422 VALIDATION_ERROR with field-level details
 *  - Everything else   → 500 INTERNAL_ERROR + logged with request id
 *
 * All responses include:
 *  - `X-Request-Id` header (UUID v4) — for log correlation
 *  - Standard JSON body: `{ error: { code, message, details? }, retryAfter? }`
 *
 * Usage:
 *   import { withApiHandler } from "@/lib/api-handler";
 *   import { HttpError } from "@/lib/http-error";
 *
 *   export const GET = withApiHandler(async (req, ctx) => {
 *     const user = await requireUser();
 *     const lead = await db.lead.findUnique({ where: { id: ctx.params.id } });
 *     if (!lead) throw HttpError.notFound();
 *     return NextResponse.json(lead);
 *   });
 *
 * The handler receives an optional `ctx` with:
 *  - `requestId` — UUID for log correlation
 *  - `params` — Next.js dynamic route params (App Router)
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { HttpError, isHttpError } from "@/lib/http-error";
import { createLogger } from "@/lib/logger";

const log = createLogger("api-handler");

// ─── Types ───────────────────────────────────────────────────────────

export interface ApiHandlerContext {
  /** UUID v4 — also sent back as `X-Request-Id` response header. */
  requestId: string;
  /** Dynamic route params (App Router style). */
  params?: Record<string, string | string[]>;
}

type NextRouteHandler<TParams = Record<string, string | string[]>> = (
  req: NextRequest,
  ctx: { params: TParams } | { params: Promise<TParams> },
) => Promise<Response> | Response;

type WrappedHandler = (
  req: NextRequest,
  ctx: ApiHandlerContext,
) => Promise<Response> | Response;

// ─── Prisma error mapping ────────────────────────────────────────────

/**
 * Prisma error codes — only the subset we map to specific HTTP responses.
 * Reference: https://www.prisma.io/docs/orm/reference/error-reference
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; code: HttpError["code"]; message: string }> = {
  // Unique constraint violation
  P2002: { status: 409, code: "CONFLICT", message: "A record with this value already exists" },
  // Record not found (findUnique on missing, or update/delete on missing)
  P2025: { status: 404, code: "NOT_FOUND", message: "Record not found" },
  // Foreign key constraint violation
  P2003: { status: 409, code: "CONFLICT", message: "Cannot delete: related records exist" },
  // Required relation violation
  P2011: { status: 422, code: "VALIDATION_ERROR", message: "Cannot null a required relation" },
  // Missing required value
  P2012: { status: 422, code: "VALIDATION_ERROR", message: "Missing required field" },
};

interface PrismaClientError {
  code: string;
  clientVersion?: string;
  meta?: unknown;
}

function isPrismaError(err: unknown): err is PrismaClientError {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  return typeof e.code === "string" && typeof e.code === "string" && e.code.startsWith("P");
}

function mapPrismaError(err: PrismaClientError, requestId: string): HttpError {
  const mapping = PRISMA_ERROR_MAP[err.code];
  if (mapping) {
    log.warn("Prisma error mapped to HTTP", {
      requestId,
      prismaCode: err.code,
      httpStatus: mapping.status,
      httpCode: mapping.code,
    });
    return new HttpError(mapping.status, mapping.message, mapping.code, {
      details: { prismaCode: err.code, meta: err.meta },
    });
  }
  // Unknown Prisma error — log and return 500
  log.error("Unmapped Prisma error", {
    requestId,
    prismaCode: err.code,
    meta: err.meta,
  });
  return HttpError.internal("Database error");
}

// ─── Zod error mapping ──────────────────────────────────────────────

interface ZodError {
  name: "ZodError";
  issues: Array<{
    path: (string | number)[];
    message: string;
    code: string;
  }>;
}

function isZodError(err: unknown): err is ZodError {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  return e.name === "ZodError" && Array.isArray(e.issues);
}

function mapZodError(err: ZodError, requestId: string): HttpError {
  log.debug("Zod validation error", { requestId, issueCount: err.issues.length });
  return HttpError.validation("Validation failed", {
    fields: err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

// ─── Response builder ───────────────────────────────────────────────

function buildErrorResponse(err: HttpError, requestId: string): NextResponse {
  const body = err.toJSON();
  const headers: Record<string, string> = {
    "X-Request-Id": requestId,
    "Content-Type": "application/json",
  };
  if (err.retryAfter !== undefined) {
    headers["Retry-After"] = String(err.retryAfter);
  }
  return NextResponse.json(body, { status: err.status, headers });
}

function buildSuccessResponse(response: Response, requestId: string): Response {
  // Attach X-Request-Id to successful responses too (for client-side correlation)
  try {
    response.headers.set("X-Request-Id", requestId);
  } catch {
    // Some Response types (NextResponse.redirect) may have immutable headers
    // — best-effort, don't fail the request.
  }
  return response;
}

// ─── Public HOC ─────────────────────────────────────────────────────

/**
 * Wrap a Next.js API route handler with global error handling.
 *
 * The wrapped handler receives a simplified context with `requestId` and
 * (optionally) `params` already awaited (App Router 15+ passes params as
 * a Promise — we await it for you).
 *
 * Errors thrown inside the handler are caught and mapped:
 *  - HttpError         → its own status + body
 *  - Prisma P2002      → 409 CONFLICT
 *  - Prisma P2025      → 404 NOT_FOUND
 *  - Prisma P2003/P2011/P2012 → 422 / 409
 *  - ZodError          → 422 VALIDATION_ERROR with field details
 *  - Other Error       → 500 INTERNAL_ERROR (logged with stack)
 *
 * All responses include `X-Request-Id` for log correlation.
 */
export function withApiHandler(handler: WrappedHandler): NextRouteHandler {
  return async (req, ctx) => {
    const requestId = randomUUID();

    // App Router 15+ passes params as a Promise — await it if needed.
    let params: Record<string, string | string[]> = {};
    if (ctx && "params" in ctx) {
      try {
        params = ctx.params instanceof Promise ? await ctx.params : ctx.params;
      } catch {
        // If params fail to resolve, leave as empty object — handler can
        // produce its own 400 if it expected them.
      }
    }

    try {
      const response = await handler(req, { requestId, params });
      return buildSuccessResponse(response, requestId);
    } catch (err) {
      // Already a typed HTTP error — serialize directly
      if (isHttpError(err)) {
        return buildErrorResponse(err, requestId);
      }

      // Zod validation error → 422
      if (isZodError(err)) {
        return buildErrorResponse(mapZodError(err, requestId), requestId);
      }

      // Prisma error → mapped 4xx or 500
      if (isPrismaError(err)) {
        return buildErrorResponse(mapPrismaError(err, requestId), requestId);
      }

      // Unknown error — log with stack, return generic 500
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      log.error("Unhandled API error", {
        requestId,
        error: errorMessage,
        stack: errorStack,
        method: req.method,
        url: req.url,
      });
      return buildErrorResponse(HttpError.internal(), requestId);
    }
  };
}

/**
 * Generate a fresh request ID (used by tests + middleware).
 */
export function generateRequestId(): string {
  return randomUUID();
}
