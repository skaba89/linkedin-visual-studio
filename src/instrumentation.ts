/**
 * Next.js instrumentation hook — runs once per server boot.
 *
 * This file is the Edge-safe entry point. It immediately delegates to
 * `./instrumentation-node` when running on the Node.js runtime. Splitting
 * the Node.js-specific `process.on(...)` calls into a separate module that
 * is loaded via a dynamic `import()` keeps them out of the Edge bundle.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic import: Turbopack will only bundle `instrumentation-node` for
  // the Node.js runtime, never for the Edge runtime.
  await import("./instrumentation-node");
}
