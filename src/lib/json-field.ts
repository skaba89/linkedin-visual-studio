/**
 * HERMÈS — R-003 — JSON field helpers for Prisma string columns
 *
 * The Prisma schema stores several structured fields (arrays, objects) as
 * `String` columns because the schema predates the `Json` type or because
 * the underlying database doesn't support it consistently.
 *
 * This module provides typed helpers to convert between the runtime
 * structured type (e.g. `WorkflowNode[]`) and the stored string form
 * (`JSON.stringify`), with safe parsing that never throws.
 *
 * Usage in engines:
 *   import { parseJsonField, stringifyJsonField } from "@/lib/json-field";
 *
 *   const nodes = parseJsonField<WorkflowNode[]>(row.nodes, []);
 *   await db.workflow.update({
 *     where: { id },
 *     data: { nodes: stringifyJsonField(nodes) },
 *   });
 *
 * Why a dedicated module:
 *  - Centralizes the JSON parse/stringify logic so all engines use the
 *    same convention (no `as unknown as T` casts scattered everywhere)
 *  - Provides a safe default value when the stored string is null,
 *    undefined, empty, or malformed (defensive against DB drift)
 *  - Type-safe: the helper is generic, so callers get back the exact
 *    type they expect without manual casts
 */

/**
 * Parse a JSON string field from Prisma into a typed value.
 *
 * @param stored  — the raw string from the DB (may be null/undefined/empty)
 * @param fallback — value returned if parsing fails or stored is falsy
 * @returns the parsed value (typed T), or `fallback` on any error
 */
export function parseJsonField<T>(
  stored: string | null | undefined,
  fallback: T,
): T {
  if (!stored || typeof stored !== "string") return fallback;
  try {
    const parsed = JSON.parse(stored);
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Serialize a typed value to a JSON string for Prisma storage.
 *
 * Returns "null" for null/undefined so Prisma columns can stay NOT NULL
 * (use `null` literal only if the column is nullable).
 */
export function stringifyJsonField<T>(value: T): string {
  if (value === null || value === undefined) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    return "null";
  }
}

/**
 * Type-safe JSON parse with explicit fallback.
 *
 * Difference vs `parseJsonField`: this one is intended for parsing strings
 * that came from external sources (HTTP bodies, env vars) where the type
 * may not match what we expect. Always returns the fallback on any error.
 */
export function safeJsonParse<T>(input: unknown, fallback: T): T {
  if (typeof input !== "string") return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
