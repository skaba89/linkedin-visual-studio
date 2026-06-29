/**
 * HERMÈS — R-001 / R-007 — POST /api/auth/register
 *
 * Creates a new user with email + password (scrypt-hashed).
 *
 * Request body (JSON):
 *   { "email": "you@example.com", "password": "********", "name": "Jane" }
 *
 * Responses:
 *   201 Created        — { id, email, name, role, createdAt }
 *   409 Conflict       — email already taken
 *   422 Validation err — invalid email / weak password
 *   429 Too Many Requests — rate-limited (5/min per IP, R-007)
 *   500 Internal err   — unexpected
 *
 * Security notes:
 *  - Password is validated via `assertPasswordStrength` (≥ 12 chars, mixed).
 *  - Email is normalized to lowercase + trimmed.
 *  - The response NEVER includes `passwordHash`.
 *  - Rate-limited via withRateLimit("register") — 5 attempts/min per IP (R-007).
 *    Prevents spam registration / email enumeration.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, assertPasswordStrength } from "@/lib/password";
import { HttpError, isHttpError } from "@/lib/http-error";
import { withRateLimit } from "@/lib/rate-limit-wrapper";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withRateLimit(
  "register",
  async (req: NextRequest) => {
    try {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new HttpError(422, "Invalid JSON body", "VALIDATION_ERROR");
      }

      const { email, password, name } = (body ?? {}) as {
        email?: unknown;
        password?: unknown;
        name?: unknown;
      };

      // ── Validate email ──────────────────────────────────────────────
      if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
        throw new HttpError(
          422,
          "Invalid email",
          "VALIDATION_ERROR",
          { field: "email" },
        );
      }
      const normalizedEmail = email.trim().toLowerCase();

      // ── Validate password ───────────────────────────────────────────
      if (typeof password !== "string") {
        throw new HttpError(
          422,
          "Password is required",
          "VALIDATION_ERROR",
          { field: "password" },
        );
      }
      try {
        assertPasswordStrength(password);
      } catch (err) {
        throw new HttpError(
          422,
          err instanceof Error ? err.message : "Password too weak",
          "PASSWORD_TOO_WEAK",
          { field: "password" },
        );
      }

      // ── Validate name (optional) ────────────────────────────────────
      const trimmedName =
        typeof name === "string" && name.trim().length > 0
          ? name.trim().slice(0, 100)
          : null;

      // ── Check for existing user (race-safe via unique constraint) ──
      const existing = await db.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existing) {
        throw new HttpError(
          409,
          "Email already registered",
          "EMAIL_ALREADY_TAKEN",
        );
      }

      // ── Hash password & create user ─────────────────────────────────
      const passwordHash = await hashPassword(password);

      const user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: trimmedName,
          passwordHash,
          role: "USER",
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      return NextResponse.json(user, { status: 201 });
    } catch (err) {
      if (isHttpError(err)) {
        return NextResponse.json(err.toJSON(), { status: err.status });
      }
      // Prisma unique-constraint violation (race condition on email)
      if (
        err !== null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        const conflict = new HttpError(
          409,
          "Email already registered",
          "EMAIL_ALREADY_TAKEN",
        );
        return NextResponse.json(conflict.toJSON(), { status: 409 });
      }
      console.error("[register] unexpected error:", err);
      const internal = new HttpError(500, "Internal server error");
      return NextResponse.json(internal.toJSON(), { status: 500 });
    }
  },
);
