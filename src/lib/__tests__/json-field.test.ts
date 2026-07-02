/**
 * HERMÈS — R-003 — Tests unitaires pour src/lib/json-field.ts
 *
 * Couvre :
 *  - parseJsonField : parsing réussi, fallback sur null/undefined/empty,
 *    fallback sur JSON invalide, fallback typé
 *  - stringifyJsonField : sérialisation, gestion null/undefined, gestion
 *    circular reference
 *  - safeJsonParse : parsing safe avec type fallback, gestion non-string
 *
 * Run : npx vitest run src/lib/__tests__/json-field.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseJsonField, stringifyJsonField, safeJsonParse } from "@/lib/json-field";

// ─── parseJsonField ────────────────────────────────────────────────

describe("parseJsonField", () => {
  it("parses a valid JSON string", () => {
    const result = parseJsonField<number[]>("[1, 2, 3]", []);
    expect(result).toEqual([1, 2, 3]);
  });

  it("parses a valid JSON object", () => {
    const result = parseJsonField<{ a: number; b: string }>('{"a":1,"b":"x"}', { a: 0, b: "" });
    expect(result).toEqual({ a: 1, b: "x" });
  });

  it("returns fallback when stored is null", () => {
    const fallback = { default: true };
    const result = parseJsonField(null, fallback);
    expect(result).toBe(fallback);
  });

  it("returns fallback when stored is undefined", () => {
    const fallback = [1, 2, 3];
    const result = parseJsonField(undefined, fallback);
    expect(result).toBe(fallback);
  });

  it("returns fallback when stored is an empty string", () => {
    const fallback = { default: true };
    const result = parseJsonField("", fallback);
    expect(result).toBe(fallback);
  });

  it("returns fallback when stored is malformed JSON", () => {
    const fallback = ["default"];
    const result = parseJsonField("not-valid-json{", fallback);
    expect(result).toBe(fallback);
  });

  it("preserves the fallback type via generic", () => {
    interface MyType { count: number; label: string }
    const fallback: MyType = { count: 0, label: "default" };
    const result = parseJsonField<MyType>('{"count":42,"label":"answer"}', fallback);
    expect(result).toEqual({ count: 42, label: "answer" });
    // Type assertion: result should be MyType, not unknown
    expect(result.count).toBe(42);
  });

  it("handles JSON null literal", () => {
    // JSON null is a valid value, parsed to null (NOT fallback)
    const result = parseJsonField<string | null>("null", "fallback");
    expect(result).toBeNull();
  });
});

// ─── stringifyJsonField ────────────────────────────────────────────

describe("stringifyJsonField", () => {
  it("serializes an array", () => {
    expect(stringifyJsonField([1, 2, 3])).toBe("[1,2,3]");
  });

  it("serializes an object", () => {
    expect(stringifyJsonField({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
  });

  it("serializes a string", () => {
    expect(stringifyJsonField("hello")).toBe('"hello"');
  });

  it("serializes a number", () => {
    expect(stringifyJsonField(42)).toBe("42");
  });

  it("returns 'null' for null input", () => {
    expect(stringifyJsonField(null)).toBe("null");
  });

  it("returns 'null' for undefined input", () => {
    expect(stringifyJsonField(undefined)).toBe("null");
  });

  it("returns 'null' on circular reference (safe fallback)", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(stringifyJsonField(circular)).toBe("null");
  });

  it("round-trips via parseJsonField", () => {
    const original = { foo: "bar", count: 42, list: [1, 2, 3] };
    const stored = stringifyJsonField(original);
    const parsed = parseJsonField(stored, null);
    expect(parsed).toEqual(original);
  });
});

// ─── safeJsonParse ─────────────────────────────────────────────────

describe("safeJsonParse", () => {
  it("parses a valid string", () => {
    expect(safeJsonParse("[1, 2, 3]", [])).toEqual([1, 2, 3]);
  });

  it("returns fallback for malformed JSON", () => {
    expect(safeJsonParse("not json", "fallback")).toBe("fallback");
  });

  it("returns fallback for non-string input", () => {
    expect(safeJsonParse(42, "fallback")).toBe("fallback");
    expect(safeJsonParse(null, "fallback")).toBe("fallback");
    expect(safeJsonParse(undefined, "fallback")).toBe("fallback");
    expect(safeJsonParse({ a: 1 }, "fallback")).toBe("fallback");
  });

  it("preserves the fallback type via generic", () => {
    interface Config { enabled: boolean; limit: number }
    const fallback: Config = { enabled: false, limit: 10 };
    const result = safeJsonParse<Config>('{"enabled":true,"limit":100}', fallback);
    expect(result).toEqual({ enabled: true, limit: 100 });
  });

  it("handles JSON null literal", () => {
    const result = safeJsonParse<string | null>("null", "fallback");
    expect(result).toBeNull();
  });
});
