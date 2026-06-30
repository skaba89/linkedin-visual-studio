/**
 * HERMÈS — R-012 — Tests unitaires pour src/lib/sanitize-text.ts
 *
 * Couvre :
 *  - stripEmojis : emojis simples, séquences ZWJ, drapeaux, sélecteurs de variation
 *  - stripEmojis : préserve les caractères accentués, symboles math, flèches
 *  - stripEmojis : préserve les newlines et la structure des paragraphes
 *  - stripEmojis : collapse des espaces multiples laissés par le retrait
 *  - stripEmojis : cas limites (null, undefined, chaîne vide)
 *  - stripEmojisFromFields : applique stripEmojis sur les champs spécifiés
 *
 * Run : npx vitest run src/lib/__tests__/sanitize-text.test.ts
 */

import { describe, it, expect } from "vitest";
import { stripEmojis, stripEmojisFromFields } from "@/lib/sanitize-text";

describe("stripEmojis — basic emoji removal", () => {
  it("removes a single emoji", () => {
    expect(stripEmojis("Hello 🚀 world")).toBe("Hello world");
  });

  it("removes multiple emojis of different kinds", () => {
    expect(stripEmojis("🚀 Big news! 💡 Voici 3 astuces 🎯")).toBe(
      "Big news! Voici 3 astuces"
    );
  });

  it("removes emoji at the start and end", () => {
    expect(stripEmojis("🔥 Hook percutant 📈")).toBe("Hook percutant");
  });

  it("removes hand-picked common LinkedIn emojis", () => {
    const emojis = "🚀💡✨🔥👍🎯📈✅❌⚠️💬📌🔔👏💪🤖📊";
    expect(stripEmojis(emojis)).toBe("");
  });

  it("removes flag emojis (regional indicator pairs)", () => {
    expect(stripEmojis("Hello 🇫🇷 world 🇪🇺")).toBe("Hello world");
  });

  it("removes ZWJ emoji sequences (e.g. family)", () => {
    // 👨‍👩‍👧 = U+1F468 U+200D U+1F469 U+200D U+1F467
    expect(stripEmojis("Famille: 👨‍👩‍👧")).toBe("Famille:");
  });

  it("removes skin-tone modifier emojis", () => {
    // 👍🏽 = thumbs up + skin tone
    expect(stripEmojis("Cool 👍🏽 mec")).toBe("Cool mec");
  });
});

describe("stripEmojis — preserves legitimate content", () => {
  it("preserves French accented characters", () => {
    expect(stripEmojis("Voici l'été à Paris — très joli")).toBe(
      "Voici l'été à Paris — très joli"
    );
  });

  it("preserves math symbols", () => {
    expect(stripEmojis("10 × 5 ≥ 49, √2 ≈ 1.41, π ≈ 3.14")).toBe(
      "10 × 5 ≥ 49, √2 ≈ 1.41, π ≈ 3.14"
    );
  });

  it("preserves arrow symbols", () => {
    expect(stripEmojis("Hook → CTA → Conversion")).toBe(
      "Hook → CTA → Conversion"
    );
  });

  it("preserves punctuation", () => {
    expect(stripEmojis("Bonjour ! Comment ça va ?")).toBe(
      "Bonjour ! Comment ça va ?"
    );
  });

  it("preserves quotes and parentheses", () => {
    expect(stripEmojis(`"Citation" (et parenthèse)`)).toBe(
      `"Citation" (et parenthèse)`
    );
  });
});

describe("stripEmojis — whitespace handling", () => {
  it("preserves newlines (paragraph structure)", () => {
    const input = "🚀 Line 1\n\nLine 2\nLine 3 📊";
    expect(stripEmojis(input)).toBe("Line 1\n\nLine 2\nLine 3");
  });

  it("collapses multiple spaces left by emoji removal", () => {
    expect(stripEmojis("word 🚀 word 💡 word")).toBe("word word word");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripEmojis("  Hello world  ")).toBe("Hello world");
  });

  it("trims whitespace on each line", () => {
    expect(stripEmojis("  Line 1  \n  Line 2  ")).toBe("Line 1\nLine 2");
  });
});

describe("stripEmojis — edge cases", () => {
  it("returns empty string for null input", () => {
    expect(stripEmojis(null as unknown as string)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(stripEmojis(undefined as unknown as string)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(stripEmojis("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(stripEmojis("   \n  \t  ")).toBe("");
  });

  it("returns the string unchanged if no emojis", () => {
    expect(stripEmojis("Hello world")).toBe("Hello world");
  });

  it("handles a realistic LinkedIn post without emojis", () => {
    const post = `87% des équipes B2B utilisent l'IA en 2026.

Mais seulement 12% en tirent un ROI mesurable.

La différence ? Elles ont automatisé la_qualification, pas la publication.

Et vous, où en êtes-vous ?`;

    expect(stripEmojis(post)).toBe(post);
  });

  it("handles a realistic LinkedIn post WITH emojis", () => {
    const post = `🚀 87% des équipes B2B utilisent l'IA en 2026.

💡 Mais seulement 12% en tirent un ROI mesurable 📊

La différence ? Elles ont automatisé la qualification 🎯

Et vous, où en êtes-vous ? 👇`;

    const expected = `87% des équipes B2B utilisent l'IA en 2026.

Mais seulement 12% en tirent un ROI mesurable

La différence ? Elles ont automatisé la qualification

Et vous, où en êtes-vous ?`;

    expect(stripEmojis(post)).toBe(expected);
  });
});

describe("stripEmojisFromFields", () => {
  it("strips emojis from specified string fields only", () => {
    const input = { text: "🚀 post", hook: "💡 idée", score: 42 };
    const result = stripEmojisFromFields(input, ["text", "hook"]);
    expect(result.text).toBe("post");
    expect(result.hook).toBe("idée");
    expect(result.score).toBe(42);
  });

  it("leaves unspecified fields untouched", () => {
    const input = { text: "🚀 post", untouched: "💡 keep emoji" };
    const result = stripEmojisFromFields(input, ["text"]);
    expect(result.text).toBe("post");
    expect(result.untouched).toBe("💡 keep emoji");
  });

  it("handles missing fields gracefully", () => {
    const input = { text: "post" };
    const result = stripEmojisFromFields(input, ["text", "missing" as keyof typeof input]);
    expect(result.text).toBe("post");
  });

  it("handles non-string fields gracefully", () => {
    const input = { text: "🚀 post", count: 5, list: ["a", "b"] };
    const result = stripEmojisFromFields(input, ["text", "count", "list"]);
    expect(result.text).toBe("post");
    expect(result.count).toBe(5);
    expect(result.list).toEqual(["a", "b"]);
  });

  it("returns a new object (does not mutate input)", () => {
    const input = { text: "🚀 post" };
    const result = stripEmojisFromFields(input, ["text"]);
    expect(result).not.toBe(input);
    expect(input.text).toBe("🚀 post"); // original untouched
    expect(result.text).toBe("post");
  });
});
