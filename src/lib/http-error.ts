/**
 * HERMÈS — R-001 / R-005 / R-008 — HTTP error class
 *
 * A minimal typed error that carries an HTTP status code and a stable
 * machine-readable `code` field. The global API error handler
 * (`src/app/api/_error-handler.ts`, R-008) catches these and serializes
 * them as:
 *
 *   { "error": { "code": "AUTH_REQUIRED", "message": "Unauthorized" } }
 *
 * Why this exists:
 *  - Replace ad-hoc `NextResponse.json({ error: "..." }, { status: 4xx })`
 *    patterns scattered across routes.
 *  - Allow typed `try/catch` in helpers (`requireUser`, `assertOwnership`)
 *    that need to short-circuit with a non-2xx status.
 *  - Give the API consumer a stable `code` field they can branch on
 *    regardless of `message` wording changes.
 *
 * This is a precursor to the full R-005/R-008 `ApiError` factory; for now
 * it covers the 401/403/404/422/500 cases needed by R-001 auth.
 */

export type HttpErrorCode =
  | "AUTH_REQUIRED"
  | "USER_NOT_FOUND"
  | "ADMIN_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_TAKEN"
  | "PASSWORD_TOO_WEAK"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class HttpError extends Error {
  readonly status: number;
  readonly code: HttpErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code: HttpErrorCode = "INTERNAL_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;

    // Restore prototype chain (Error subclass quirk under ES5 targets)
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  /** Convenience factory: 401 Unauthorized */
  static unauthorized(
    message = "Unauthorized",
    code: HttpErrorCode = "AUTH_REQUIRED",
  ): HttpError {
    return new HttpError(401, message, code);
  }

  /** Convenience factory: 403 Forbidden */
  static forbidden(
    message = "Forbidden",
    code: HttpErrorCode = "ADMIN_REQUIRED",
  ): HttpError {
    return new HttpError(403, message, code);
  }

  /** Convenience factory: 404 Not Found */
  static notFound(
    message = "Resource not found",
    code: HttpErrorCode = "NOT_FOUND",
  ): HttpError {
    return new HttpError(404, message, code);
  }

  /** Convenience factory: 422 Validation error */
  static validation(
    message = "Validation error",
    code: HttpErrorCode = "VALIDATION_ERROR",
    details?: unknown,
  ): HttpError {
    return new HttpError(422, message, code, details);
  }

  /** Convenience factory: 409 Conflict */
  static conflict(
    message = "Conflict",
    code: HttpErrorCode = "CONFLICT",
  ): HttpError {
    return new HttpError(409, message, code);
  }

  /** Convenience factory: 500 Internal error */
  static internal(
    message = "Internal server error",
    code: HttpErrorCode = "INTERNAL_ERROR",
  ): HttpError {
    return new HttpError(500, message, code);
  }

  /** Serialize to a plain JSON-friendly object. */
  toJSON(): { error: { code: string; message: string; details?: unknown } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

/**
 * Type guard: is this error (or anything thrown) an `HttpError`?
 */
export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
