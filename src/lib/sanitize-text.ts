/**
 * HERMÈS — Sanitizer for AI-generated text
 *
 * Policy (R-012): AI-generated posts and comments must NEVER contain emojis.
 *
 * This module enforces the policy at multiple layers:
 *  1. AI prompts explicitly say "Pas d'émoji"
 *  2. This `stripEmojis()` is applied to every AI-generated text BEFORE it is
 *     stored in the app store, displayed to the user, or sent to LinkedIn's API.
 *  3. The LinkedIn post/comment API routes apply it again as a last line of
 *     defense, so even hand-typed content with emojis is sanitized before
 *     publication.
 *
 * Design notes:
 *  - Uses Unicode property escapes (\p{Extended_Pictographic}) which are
 *    supported natively in modern Node.js (V8) and Next.js toolchains.
 *  - Explicitly strips skin-tone modifiers (U+1F3FB–U+1F3FF), regional
 *    indicator pairs (flag emojis), and variation selectors (U+FE0F / U+FE0E).
 *  - Does NOT strip math symbols (× ÷ ± ≤ ≥ √ ∑ ∫ π ∠ Δ), arrows (→ ← ↑ ↓),
 *    or accented Latin characters (é è à ç ...). These are legitimate content.
 *  - Preserves newlines (paragraph structure) but trims whitespace on each
 *    line and collapses 3+ consecutive newlines to a single paragraph break.
 */

/**
 * Match a single pictographic emoji, OR a regional-indicator pair (flag),
 * OR a skin-tone modifier.
 *
 * - \p{Extended_Pictographic} — covers the bulk of single emojis
 * - [\u{1F1E6}-\u{1F1FF}]{2} — flag emoji pairs (e.g. 🇫🇷)
 * - [\u{1F3FB}-\u{1F3FF}] — Fitzpatrick skin-tone modifiers
 *
 * The `u` flag enables Unicode mode (required for \p{...} and code point ranges).
 */
const EMOJI_PATTERN =
  /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F3FB}-\u{1F3FF}]/gu;

/**
 * Match orphaned variation selectors and ZWJ that survive emoji removal.
 * U+FE0F = VARIATION SELECTOR-16 (emoji presentation)
 * U+FE0E = VARIATION SELECTOR-15 (text presentation)
 * U+200D = ZERO WIDTH JOINER (used to build emoji sequences like 👨‍👩‍👧)
 */
const VARIATION_SELECTOR_PATTERN = /[\u{FE0F}\u{FE0E}\u{200D}]/gu;

/**
 * Match leading or trailing whitespace on a single line.
 * Used after splitting on newlines so newlines are never consumed here.
 */
const LINE_TRIM_PATTERN = /^[ \t]+|[ \t]+$/g;

/**
 * Match a run of 2+ spaces/tabs (caused by emoji removal inside a line).
 * Newlines are intentionally excluded so paragraph structure is preserved.
 */
const MULTI_SPACE_PATTERN = /[ \t]{2,}/g;

/**
 * Match 3+ consecutive newlines (caused by emoji removal on standalone lines).
 * Collapsed to a single paragraph break (2 newlines).
 */
const MULTI_NEWLINE_PATTERN = /\n{3,}/g;

/**
 * Strip all emojis and orphaned variation selectors from a string.
 * Collapses the resulting whitespace but preserves paragraph breaks.
 *
 * @param text - Input text, possibly containing emojis
 * @returns Sanitized text with all emojis removed
 *
 * @example
 * stripEmojis("🚀 Big news! Voici 3 astuces 💡") // → "Big news! Voici 3 astuces"
 * stripEmojis("Hook percutant → CTA")            // → "Hook percutant → CTA" (arrow preserved)
 * stripEmojis("10 × 5 ≥ 49")                      // → "10 × 5 ≥ 49" (math symbols preserved)
 * stripEmojis(null as unknown as string)          // → ""
 */
export function stripEmojis(text: string | null | undefined): string {
  if (!text || typeof text !== "string") return "";

  // 1. Remove pictographic emojis, flag pairs, and skin-tone modifiers
  let cleaned = text.replace(EMOJI_PATTERN, "");

  // 2. Remove orphaned variation selectors left behind by step 1
  cleaned = cleaned.replace(VARIATION_SELECTOR_PATTERN, "");

  // 3. Trim leading/trailing whitespace on each line (preserves newlines)
  const lines = cleaned.split("\n").map((line) =>
    line.replace(LINE_TRIM_PATTERN, "")
  );
  cleaned = lines.join("\n");

  // 4. Collapse 3+ consecutive newlines into a single paragraph break
  cleaned = cleaned.replace(MULTI_NEWLINE_PATTERN, "\n\n");

  // 5. Collapse runs of 2+ spaces/tabs inside lines (after emoji removal)
  cleaned = cleaned.replace(MULTI_SPACE_PATTERN, " ");

  // 6. Final trim of the whole string (handles leading/trailing whitespace
  //    and any newlines left at the very start or end)
  return cleaned.trim();
}

/**
 * Strip emojis from every string field of an object, in place.
 * Useful for sanitizing parsed AI JSON responses before they're stored.
 *
 * Only top-level string fields are touched. Nested objects/arrays are left
 * untouched — call `stripEmojis` on the relevant nested field explicitly.
 *
 * @example
 * const obj = stripEmojisFromFields({ text: "🚀 post", hook: "💡 idée", score: 42 });
 * // → { text: "post", hook: "idée", score: 42 }
 */
export function stripEmojisFromFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[field as string] = stripEmojis(value);
    }
  }
  return result;
}
