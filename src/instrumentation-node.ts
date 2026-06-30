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
 */

import { createLogger } from "@/lib/logger";

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
