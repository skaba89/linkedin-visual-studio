/**
 * HERMÈS — R-001 / R-002 — Session & multi-tenant helpers
 *
 * These helpers wrap NextAuth's `getServerSession` and enforce that every
 * API route is tied to an authenticated user. The pattern is:
 *
 *   export async function GET() {
 *     const user = await requireUser();
 *     const leads = await db.lead.findMany({ where: { userId: user.id } });
 *     ...
 *   }
 *
 * Replaces the legacy `DEFAULT_USER_ID = "default"` constant from `src/lib/db.ts`
 * which gave every visitor access to the same shared data.
 *
 * Helpers:
 *  - getSession()        — returns Session | null (never throws)
 *  - requireSession()    — returns Session, or throws 401
 *  - requireUser()       — returns the authenticated User row, or throws 401
 *  - requireAdmin()      — returns User if role==='ADMIN', else throws 403
 *  - assertOwnership()   — throws 404 if a resource doesn't belong to the user
 *
 * The 401/403/404 throws use the `HttpError` class from `src/lib/http-error.ts`
 * (created in this same fix) which the global error handler maps to a JSON
 * response with the correct status code.
 */

import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";
import { HttpError } from "@/lib/http-error";

/** Session type returned by `getSession()` (mirrors next-auth Session). */
export type AppSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;
  };
  expires: string;
};

/**
 * Return the current NextAuth session, or `null` if unauthenticated.
 * Safe to call in Server Components and API routes.
 */
export async function getSession(): Promise<AppSession | null> {
  const session = await getServerSession();
  if (!session?.user?.id) return null;
  return session as unknown as AppSession;
}

/**
 * Require an authenticated session.
 * @throws HttpError(401) if not authenticated.
 */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    throw new HttpError(401, "Unauthorized", "AUTH_REQUIRED");
  }
  return session;
}

/**
 * Require an authenticated session AND return the corresponding Prisma User row.
 * @throws HttpError(401) if not authenticated.
 * @throws HttpError(404, code=USER_NOT_FOUND) if the user was deleted.
 */
export async function requireUser(): Promise<User> {
  const session = await requireSession();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      passwordHash: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    throw new HttpError(404, "User not found", "USER_NOT_FOUND");
  }
  return user as unknown as User;
}

/**
 * Require an admin user (role === 'ADMIN').
 * @throws HttpError(401) if not authenticated.
 * @throws HttpError(403) if authenticated but not admin.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden: admin role required", "ADMIN_REQUIRED");
  }
  return user;
}

/**
 * Assert that a resource belongs to the given user.
 * If not, throw 404 (not 403 — avoid leaking existence).
 *
 * Usage:
 *   const user = await requireUser();
 *   const lead = await db.lead.findUnique({ where: { id } });
 *   assertOwnership(lead, user.id);
 *
 * @param resource — the Prisma record (or null/undefined)
 * @param userId   — the authenticated user's id
 * @throws HttpError(404) if resource is null OR belongs to a different user
 */
export function assertOwnership<T extends { userId?: string | null }>(
  resource: T | null | undefined,
  userId: string,
): asserts resource is T & { userId: string } {
  if (!resource) {
    throw new HttpError(404, "Resource not found", "NOT_FOUND");
  }
  if (resource.userId !== userId) {
    // Deliberately 404, not 403 — don't leak existence.
    throw new HttpError(404, "Resource not found", "NOT_FOUND");
  }
}

/**
 * Convenience: filter Prisma `where` clauses by the current user's id.
 * Returns `{ userId }` so it can be spread.
 *
 * Usage:
 *   const user = await requireUser();
 *   const leads = await db.lead.findMany({ where: ownerFilter(user.id) });
 */
export function ownerFilter(userId: string): { userId: string } {
  return { userId };
}
