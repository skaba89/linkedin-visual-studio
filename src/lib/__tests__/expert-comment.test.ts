/**
 * HERMÈS — Phase 3.9 — Unit tests for the expert-comment sanitizer
 *
 * Verifies that the anti-AI-detection rules are enforced:
 *   - AI tics ("Great point", "Spot on", etc.) are stripped
 *   - Em-dashes are replaced with regular hyphens
 *   - Emojis are stripped (R-012)
 *   - Emptied comments are rejected at the generator level
 *   - The sanitizer is idempotent (running it twice doesn't change the output)
 *   - Whitespace is collapsed cleanly
 */
import { describe, it, expect } from "vitest";
import { sanitizeExpertComment } from "@/lib/linkedin/expert-comment";

describe("sanitizeExpertComment", () => {
  describe("AI tic removal", () => {
    it("removes 'Great point!' tic", () => {
      const { text, fixedViolations } = sanitizeExpertComment(
        "Great point! J'ai vu le même pattern chez trois clients SaaS cette année.",
      );
      expect(text.toLowerCase()).not.toContain("great point");
      expect(fixedViolations).toContainEqual(expect.stringMatching(/tic_removed/));
      expect(text.length).toBeGreaterThan(20);
    });

    it("removes 'Spot on' tic", () => {
      const { text } = sanitizeExpertComment(
        "Spot on. Le CAC moyen en B2B SaaS a augmenté de 60% depuis 2019 selon OpenView.",
      );
      expect(text.toLowerCase()).not.toContain("spot on");
    });

    it("removes 'Thanks for sharing' tic", () => {
      const { text } = sanitizeExpertComment(
        "Thanks for sharing. La donnée sur l'engagement confirme ce qu'on voit en sales.",
      );
      expect(text.toLowerCase()).not.toContain("thanks for sharing");
    });

    it("removes 'Couldn't agree more' tic", () => {
      const { text } = sanitizeExpertComment(
        "Couldn't agree more. On a mesuré 3x plus de réponses avec des séquences de 3 messages vs 1.",
      );
      expect(text.toLowerCase()).not.toContain("couldn't agree more");
      expect(text.toLowerCase()).not.toContain("couldnt agree more");
    });

    it("removes '100%' tic", () => {
      const { text } = sanitizeExpertComment(
        "100%. Le MRR churné par les comptes < 500€ dépasse souvent 15% par mois.",
      );
      expect(text).not.toContain("100%");
    });

    it("removes 'game-changer' tic", () => {
      const { text } = sanitizeExpertComment(
        "Game-changer pour les équipes growth. On a cut le temps de prospection de 70%.",
      );
      expect(text.toLowerCase()).not.toContain("game-changer");
      expect(text.toLowerCase()).not.toContain("gamechanger");
    });

    it("removes 'amazing' tic", () => {
      const { text } = sanitizeExpertComment(
        "Amazing breakdown. Le taux de reply moyen en cold outreach est à 1.7% chez Lemlist en 2024.",
      );
      expect(text.toLowerCase()).not.toContain("amazing");
    });
  });

  describe("em-dash replacement", () => {
    it("replaces em-dashes with regular hyphens", () => {
      const { text, fixedViolations } = sanitizeExpertComment(
        "Le SaaS - modèle d'abonnement - a un CAC plus élevé mais un LTV plus prévisible.",
      );
      // Note: the input above uses regular hyphens already, so let's test with actual em-dashes
      const { text: text2, fixedViolations: fv2 } = sanitizeExpertComment(
        "Le SaaS — modèle d'abonnement — a un CAC plus élevé mais un LTV plus prévisible.",
      );
      expect(text).not.toContain("—");
      expect(text2).not.toContain("—");
      expect(fv2).toContain("em_dashes_replaced");
    });

    it("replaces double-hyphens with single hyphens", () => {
      const { text, fixedViolations } = sanitizeExpertComment(
        "Le cold outreach -- vs inbound -- a un CAC 3x plus bas en early stage.",
      );
      expect(text).not.toContain("--");
      expect(fixedViolations).toContain("em_dashes_replaced");
    });
  });

  describe("emoji stripping (R-012)", () => {
    it("strips emojis from the comment", () => {
      const { text, fixedViolations } = sanitizeExpertComment(
        "La donnée confirme: 78% des décideurs B2B préfèrent le referral au cold outreach 🚀",
      );
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(fixedViolations).toContain("emojis_removed");
    });

    it("strips multiple emojis", () => {
      const { text } = sanitizeExpertComment(
        "🔥 Super insight 💡 - le CAC a explosé de 60% 📈",
      );
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  });

  describe("whitespace cleanup", () => {
    it("collapses multiple spaces into one", () => {
      const { text } = sanitizeExpertComment(
        "Le    SaaS a   un CAC   plus élevé.",
      );
      expect(text).not.toContain("  ");
    });

    it("collapses multiple newlines into max 2", () => {
      const { text } = sanitizeExpertComment(
        "Première phrase.\n\n\n\n\nDeuxième phrase.",
      );
      expect(text).not.toMatch(/\n{3,}/);
    });
  });

  describe("leading punctuation fix", () => {
    it("removes leading orphan punctuation after tic removal", () => {
      // After "Great point!" is removed, the comment might start with ", "
      const { text } = sanitizeExpertComment(
        "Great point!, and the data shows 3x uplift.",
      );
      expect(text).not.toMatch(/^[\s,.;:!?]+/);
    });
  });

  describe("trailing punctuation", () => {
    it("adds a period if missing", () => {
      const { text } = sanitizeExpertComment(
        "Le SaaS a un CAC plus élevé mais un LTV plus prévisible",
      );
      expect(text).toMatch(/\.$/);
    });

    it("preserves existing trailing punctuation", () => {
      const { text } = sanitizeExpertComment(
        "Le SaaS a un CAC plus élevé mais un LTV plus prévisible.",
      );
      expect(text).toMatch(/\.$/);
    });

    it("preserves trailing question mark", () => {
      const { text } = sanitizeExpertComment(
        "Pourquoi le CAC est-il si élevé en early stage?",
      );
      expect(text).toMatch(/\?$/);
    });
  });

  describe("first-letter capitalization", () => {
    it("capitalizes the first letter", () => {
      const { text } = sanitizeExpertComment(
        "le SaaS a un CAC plus élevé mais un LTV plus prévisible.",
      );
      expect(text[0]).toBe("L");
    });
  });

  describe("idempotency", () => {
    it("running sanitize twice produces the same output", () => {
      const input = "Great point! 🚀 Le SaaS — modèle d'abonnement — a un CAC plus élevé.";
      const first = sanitizeExpertComment(input);
      const second = sanitizeExpertComment(first.text);
      expect(second.text).toBe(first.text);
    });
  });

  describe("realistic LinkedIn comment fixtures", () => {
    it("preserves a clean expert comment without modifications", () => {
      const clean = "Le CAC payant a augmenté de 60% en B2B SaaS depuis 2019. Les équipes qui investissent dans le content-led growth voient un CAC 3x plus bas selon OpenView 2024.";
      const { text, fixedViolations } = sanitizeExpertComment(clean);
      expect(text).toBe(clean);
      expect(fixedViolations).toHaveLength(0);
    });

    it("cleans a typical ChatGPT-style comment", () => {
      const chatGptStyle = "Great insights! 🚀 The data really shows — as you mentioned — that AI agents are a game-changer for B2B sales. Couldn't agree more with your analysis.";
      const { text, fixedViolations } = sanitizeExpertComment(chatGptStyle);
      expect(text.toLowerCase()).not.toContain("great insights");
      expect(text.toLowerCase()).not.toContain("couldn't agree more");
      expect(text.toLowerCase()).not.toContain("game-changer");
      expect(text).not.toContain("—");
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(fixedViolations.length).toBeGreaterThan(3);
    });
  });
});
