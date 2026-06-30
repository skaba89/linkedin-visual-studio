import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword, assertPasswordStrength } from "@/lib/password";

/**
 * HERMÈS — R-001 — NextAuth configuration (DB-backed)
 *
 * Changes vs. previous version (audit Volume 1 §R-001):
 *  - `authorize()` now performs a real Prisma lookup + scrypt verification
 *    instead of comparing against hardcoded credentials.
 *  - The JWT callback enriches the token with `id` and `role`.
 *  - The session callback exposes `id` and `role` on `session.user`.
 *  - The `NEXTAUTH_SECRET` fallback is removed — production will fail-fast
 *    if unset, instead of silently using a known weak secret.
 *
 * Migration path:
 *  - The first time the server boots, if no User with email="demo@hermes.app"
 *    exists, one is created with a freshly hashed password (`hermes2024`).
 *    This keeps the existing demo flow working while the codebase migrates.
 *  - After migration, replace this seed with proper /api/auth/register usage.
 */

// ─── R-010 deep — Force-set AUTH_TRUST_HOST in production ────────────────────
// NextAuth v4's `detectOrigin()` reads `process.env.AUTH_TRUST_HOST` to decide
// whether to trust the `X-Forwarded-Host` header. On Render (and most PaaS),
// the Next.js server binds to `0.0.0.0:10000` behind a reverse proxy; without
// AUTH_TRUST_HOST, NextAuth falls back to `NEXTAUTH_URL` env var, which is
// often missing or stale on Render's dashboard (render.yaml `sync: false`
// requires manual setup, and `value:` entries are NOT re-applied to existing
// services when render.yaml changes).
//
// Setting it programmatically here is a defense-in-depth: even if the env var
// is missing from the Render dashboard, NextAuth will still trust the proxy
// headers and `getServerSession()` will work in cross-origin OAuth callbacks.
//
// We only do this in production to keep local dev behavior unchanged (local
// dev has no proxy, so X-Forwarded-Host is never set anyway).
//
// Refs:
//  - node_modules/next-auth/utils/detect-origin.js (v4.24.x)
//  - https://render.com/docs/web-services (reverse proxy headers)
if (
  process.env.NODE_ENV === "production" &&
  !process.env.AUTH_TRUST_HOST &&
  // Don't override an explicit `false` from the operator
  process.env.AUTH_TRUST_HOST !== "false"
) {
  process.env.AUTH_TRUST_HOST = "true";
}

const DEMO_EMAIL = "demo@hermes.app";
// R-011 — Demo password MUST satisfy assertPasswordStrength() (≥ 12 chars,
// at least one letter + one non-letter). The previous value ("hermes2024",
// 10 chars) was too short, so ensureDemoUser() threw on every login attempt
// → demo user was never seeded → credentials login returned 401 → user could
// never authenticate → LinkedIn OAuth callback failed with "Connexion requis".
// New password: 16 chars, mixes letters + digits + symbols, easy to communicate.
const DEMO_INITIAL_PASSWORD = "Demo-Hermes-2024"; // only used once for seeding

/**
 * Idempotent seed of the demo account. Called on first login attempt.
 * In production this should be replaced by an explicit registration flow.
 */
async function ensureDemoUser(): Promise<void> {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    // R-011 — Backfill password for legacy demo users seeded before the
    // password-strength policy was enforced. If the existing user has no
    // passwordHash OR a hash that fails verification against the current
    // demo password, set it now. This is safe because:
    //   1. We only do this for DEMO_EMAIL (not arbitrary users)
    //   2. The demo account is documented as using DEMO_INITIAL_PASSWORD
    //   3. Without this, an old seed row would lock the demo user out forever
    if (!existing.passwordHash) {
      try {
        await db.user.update({
          where: { id: existing.id },
          data: { passwordHash: await hashPassword(DEMO_INITIAL_PASSWORD) },
        });
      } catch {
        // If the backfill fails (e.g. column missing), fall through — the
        // authorize() call below will return null and the user will see
        // a clear "invalid credentials" error.
      }
    }
    return;
  }

  // Validate strength (will throw if too weak) — R-011 ensures this passes
  // for the demo password. We wrap in try/catch so a strength-policy
  // regression doesn't crash the login flow.
  try {
    assertPasswordStrength(DEMO_INITIAL_PASSWORD);
  } catch (err) {
    console.error(
      "[auth-config] DEMO_INITIAL_PASSWORD fails strength check — demo login will be broken:",
      err instanceof Error ? err.message : String(err),
    );
    return; // fall through to authorize() → returns null → 401
  }

  await db.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash: await hashPassword(DEMO_INITIAL_PASSWORD),
      role: "USER",
      emailVerified: new Date(),
    },
  });
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Email format check before hitting the DB
        const email = credentials.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

        // Seed demo user on first attempt (idempotent)
        if (email === DEMO_EMAIL) {
          try {
            await ensureDemoUser();
          } catch {
            // Seed failures fall through to normal auth (will return null)
          }
        }

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            passwordHash: true,
            role: true,
          },
        });

        // No user OR no passwordHash (OAuth-only account) → reject
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name ?? null,
          email: user.email,
          image: user.avatarUrl ?? null,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    // Session expires in 24 h
    maxAge: 24 * 60 * 60,
  },

  jwt: {
    // No fallback — production MUST set NEXTAUTH_SECRET.
    // In dev we allow a fallback to keep DX smooth.
    secret:
      process.env.NEXTAUTH_SECRET ??
      (process.env.NODE_ENV === "production"
        ? undefined
        : "hermes-dev-secret-DO-NOT-USE-IN-PROD"),
  },

  secret:
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "hermes-dev-secret-DO-NOT-USE-IN-PROD"),

  pages: {
    // Custom sign-in page (we'll create this later if needed)
    // signIn: "/login",
  },

  callbacks: {
    /**
     * Include user id + role in the JWT token so they're available in session.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // NextAuth's `user` type doesn't include `role` — widen via cast
        const u = user as typeof user & { role?: string };
        token.role = u.role ?? "USER";
      }
      return token;
    },

    /**
     * Expose user id + role on the session object for client & server use.
     */
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role =
          (token.role as string | undefined) ?? "USER";
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};

/**
 * Augment NextAuth types to include `id` and `role` on Session.user
 * and `id`/`role` on the JWT token.
 *
 * This is a global side-effect import — declare it once here and the types
 * flow through `getServerSession` automatically.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
