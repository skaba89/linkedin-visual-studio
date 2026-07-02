/**
 * Next.js instrumentation hook — runs once per server boot.
 *
 * This file is the Edge-safe entry point. It immediately delegates to
 * `./instrumentation-node` when running on the Node.js runtime. Splitting
 * the Node.js-specific `process.on(...)` calls into a separate module that
 * is loaded via a dynamic `import()` keeps them out of the Edge bundle.
 *
 * R-011 deep v4: register() now AWAITS initInstrumentation(), which means
 * Next.js will not start accepting requests until the runtime schema
 * migration has completed. This eliminates the race condition where the
 * first login attempt failed because User.passwordHash didn't exist yet.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic import: Turbopack will only bundle `instrumentation-node` for
  // the Node.js runtime, never for the Edge runtime.
  const { initInstrumentation } = await import("./instrumentation-node");

  // R-011 deep v4 — Await the initialization so the schema migration
  // completes before Next.js accepts any requests. This is critical for
  // login to work on the first request after boot.
  await initInstrumentation();
}
