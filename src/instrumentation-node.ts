/**
 * Node.js-only instrumentation logic.
 *
 * This module is dynamically imported by `src/instrumentation.ts` ONLY when
 * `process.env.NEXT_RUNTIME === "nodejs"`. Splitting it out lets Turbopack
 * bundle `process.on(...)` calls exclusively in the Node.js runtime bundle,
 * keeping the Edge bundle clean (no Node.js API warnings).
 *
 * R-005: this is the safety net that catches errors which escape the
 * per-route try/catch blocks. Routes use `apiHandler()` for synchronous
 * error conversion; this catches async errors that fall through.
 *
 * R-011 deep v3: also runs the runtime User-column migration at boot,
 * so the passwordHash column is ensured even if prisma migrate deploy
 * failed and the startCommand fallbacks didn't run.
 */

import { createLogger } from "@/lib/logger";
import { ensureUserColumns } from "@/lib/runtime-migration";

const log = createLogger("instrumentation");

process.on("uncaughtException", (err) => {
  log.error("Uncaught exception", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  // Do NOT re-throw — Next.js will crash the process. In production, the
  // process manager (PM2, systemd, Render) will restart us.
});

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled promise rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // Do NOT exit — let Next.js continue serving other requests.
});

log.info("Instrumentation registered", {
  nodeEnv: process.env.NODE_ENV,
  runtime: process.env.NEXT_RUNTIME,
  // R-010 deep: log critical env vars at boot so we can diagnose OAuth
  // redirect / session issues from the Render logs without SSH access.
  nextauthUrl: process.env.NEXTAUTH_URL ?? "(not set)",
  nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "(not set)",
  authTrustHost: process.env.AUTH_TRUST_HOST ?? "(not set — will be force-set below)",
});

// R-010 deep — Force-set AUTH_TRUST_HOST in production (defense in depth).
// See src/lib/auth-config.ts for the full rationale.
if (
  process.env.NODE_ENV === "production" &&
  !process.env.AUTH_TRUST_HOST &&
  process.env.AUTH_TRUST_HOST !== "false"
) {
  process.env.AUTH_TRUST_HOST = "true";
}

// R-011 deep v3 — Run runtime User-column migration at boot.
// This ensures User.passwordHash exists even if prisma migrate deploy
// failed (e.g., due to a failed JSONB conversion in the same migration file).
// We do NOT await this — the server should boot immediately and the migration
// will complete in the background. The first login attempt may fail if it
// happens within the first ~100ms of boot, but subsequent attempts will work.
ensureUserColumns().catch((err) => {
  log.error("Runtime User-column migration failed at boot", {
    error: err instanceof Error ? err.message : String(err),
  });
});
