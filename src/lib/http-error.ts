/**
 * HERMÈS — R-001 / R-005 / R-008 — HTTP error class
 *
 * A minimal typed error that carries an HTTP status code and a stable
 * machine-readable `code` field. The global API error handler
 * (`src/lib/api-handler.ts`, R-008) catches these and serializes them as:
 *
 *   {
 *     "error": {
 *       "code": "AUTH_REQUIRED",
 *       "message": "Unauthorized",
 *       "details": { ... }        // optional
 *     },
 *     "retryAfter": 60             // optional, only for RATE_LIMITED
 *   }
 *
 * Why this exists:
 *  - Replace ad-hoc `NextResponse.json({ error: "..." }, { status: 4xx })`
 *    patterns scattered across routes.
 *  - Allow typed `try/catch` in helpers (`requireUser`, `assertOwnership`)
 *    that need to short-circuit with a non-2xx status.
 *  - Give the API consumer a stable `code` field they can branch on
 *    regardless of `message` wording changes.
 *
 * R-005 (deep): the factory now covers all HTTP 4xx/5xx codes used in the
 * app (was only 401/403/404/422/500/409). Added `retryAfter` field for
 * rate-limited responses (RFC 7231 §7.1.3).
 */

export type HttpErrorCode =
  // Auth
  | "AUTH_REQUIRED"
  | "USER_NOT_FOUND"
  | "ADMIN_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_TAKEN"
  | "PASSWORD_TOO_WEAK"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  // Validation
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PRECONDITION_FAILED"
  // Resources
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "GONE"
  // Rate limiting / quota
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  // Server-side
  | "INTERNAL_ERROR"
  | "BAD_GATEWAY"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT";

export interface HttpErrorOptions {
  /** Optional machine-readable details (validation errors, hint, etc.) */
  details?: unknown;
  /**
   * Seconds to wait before retrying — only meaningful for RATE_LIMITED /
   * QUOTA_EXCEEDED / SERVICE_UNAVAILABLE. Serialized as `Retry-After` header.
   */
  retryAfter?: number;
  /** Optional cause (for Error chaining, Node 16+). */
  cause?: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: HttpErrorCode;
  readonly details?: unknown;
  readonly retryAfter?: number;

  constructor(
    status: number,
    message: string,
    code: HttpErrorCode = "INTERNAL_ERROR",
    optionsOrDetails?: HttpErrorOptions | unknown,
  ) {
    // Backward-compat: pre-R-005 callers passed a plain `details` object as
    // the 4th arg (e.g. `new HttpError(422, "...", "VALIDATION_ERROR", { field: "id" })`).
    // R-005 introduced `HttpErrorOptions { details, retryAfter, cause }`.
    // We detect the shape and normalize so both styles work.
    let opts: HttpErrorOptions;
    if (optionsOrDetails === undefined) {
      opts = {};
    } else if (
      typeof optionsOrDetails === "object" &&
      optionsOrDetails !== null &&
      ("details" in optionsOrDetails ||
        "retryAfter" in optionsOrDetails ||
        "cause" in optionsOrDetails)
    ) {
      // R-005 style: { details, retryAfter, cause }
      opts = optionsOrDetails as HttpErrorOptions;
    } else {
      // Pre-R-005 style: plain details object
      opts = { details: optionsOrDetails };
    }

    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = opts.details;
    this.retryAfter = opts.retryAfter;

    // Restore prototype chain (Error subclass quirk under ES5 targets)
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  // ─── 4xx factories ────────────────────────────────────────────────

  /** 400 Bad Request — malformed syntax, client should not retry unchanged. */
  static badRequest(
    message = "Bad request",
    details?: unknown,
  ): HttpError {
    return new HttpError(400, message, "BAD_REQUEST", { details });
  }

  /** 401 Unauthorized — authentication required or failed. */
  static unauthorized(
    message = "Unauthorized",
    code: HttpErrorCode = "AUTH_REQUIRED",
  ): HttpError {
    return new HttpError(401, message, code);
  }

  /** 403 Forbidden — authenticated but not allowed. */
  static forbidden(
    message = "Forbidden",
    code: HttpErrorCode = "ADMIN_REQUIRED",
  ): HttpError {
    return new HttpError(403, message, code);
  }

  /** 404 Not Found — resource doesn't exist OR belongs to another user. */
  static notFound(
    message = "Resource not found",
    code: HttpErrorCode = "NOT_FOUND",
  ): HttpError {
    return new HttpError(404, message, code);
  }

  /** 405 Method Not Allowed — HTTP verb not supported on this route. */
  static methodNotAllowed(
    message = "Method not allowed",
    allowedMethods: string[] = [],
  ): HttpError {
    return new HttpError(405, message, "METHOD_NOT_ALLOWED", {
      details: allowedMethods.length ? { allowed: allowedMethods } : undefined,
    });
  }

  /** 409 Conflict — version mismatch, unique constraint, etc. */
  static conflict(
    message = "Conflict",
    code: HttpErrorCode = "CONFLICT",
    details?: unknown,
  ): HttpError {
    return new HttpError(409, message, code, { details });
  }

  /** 410 Gone — resource was permanently deleted. */
  static gone(
    message = "Resource gone",
  ): HttpError {
    return new HttpError(410, message, "GONE");
  }

  /** 412 Precondition Failed — If-Match / If-Unmodified-Since failed. */
  static preconditionFailed(
    message = "Precondition failed",
  ): HttpError {
    return new HttpError(412, message, "PRECONDITION_FAILED");
  }

  /** 422 Validation error — semantic error in the request body. */
  static validation(
    message = "Validation error",
    details?: unknown,
  ): HttpError {
    return new HttpError(422, message, "VALIDATION_ERROR", { details });
  }

  /** 413 Payload Too Large — request body exceeds limit. */
  static payloadTooLarge(
    message = "Payload too large",
    limit?: number,
  ): HttpError {
    return new HttpError(413, message, "PAYLOAD_TOO_LARGE", {
      details: limit !== undefined ? { limit } : undefined,
    });
  }

  /** 415 Unsupported Media Type — wrong Content-Type. */
  static unsupportedMediaType(
    message = "Unsupported media type",
    expected?: string,
  ): HttpError {
    return new HttpError(415, message, "UNSUPPORTED_MEDIA_TYPE", {
      details: expected !== undefined ? { expected } : undefined,
    });
  }

  /** 429 Too Many Requests — rate limited. Use `retryAfter` (seconds). */
  static tooManyRequests(
    message = "Too many requests",
    retryAfter?: number,
  ): HttpError {
    return new HttpError(429, message, "RATE_LIMITED", { retryAfter });
  }

  /** 429 Quota exceeded — daily/monthly quota hit, distinct from rate limit. */
  static quotaExceeded(
    message = "Quota exceeded",
    retryAfter?: number,
  ): HttpError {
    return new HttpError(429, message, "QUOTA_EXCEEDED", { retryAfter });
  }

  // ─── 5xx factories ────────────────────────────────────────────────

  /** 500 Internal error — generic server-side failure. */
  static internal(
    message = "Internal server error",
    code: HttpErrorCode = "INTERNAL_ERROR",
  ): HttpError {
    return new HttpError(500, message, code);
  }

  /** 502 Bad Gateway — upstream returned an invalid response. */
  static badGateway(
    message = "Bad gateway",
    upstream?: string,
  ): HttpError {
    return new HttpError(502, message, "BAD_GATEWAY", {
      details: upstream !== undefined ? { upstream } : undefined,
    });
  }

  /** 503 Service Unavailable — temporary outage, retry later. */
  static serviceUnavailable(
    message = "Service unavailable",
    retryAfter?: number,
  ): HttpError {
    return new HttpError(503, message, "SERVICE_UNAVAILABLE", { retryAfter });
  }

  /** 504 Gateway Timeout — upstream did not respond in time. */
  static gatewayTimeout(
    message = "Gateway timeout",
  ): HttpError {
    return new HttpError(504, message, "GATEWAY_TIMEOUT");
  }

  // ─── Serialization ────────────────────────────────────────────────

  /** Serialize to a plain JSON-friendly object. */
  toJSON(): {
    error: { code: string; message: string; details?: unknown };
    retryAfter?: number;
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
      ...(this.retryAfter !== undefined ? { retryAfter: this.retryAfter } : {}),
    };
  }
}

/**
 * Type guard: is this error (or anything thrown) an `HttpError`?
 */
export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
