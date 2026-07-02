/**
 * HERMÈS — Phase 3.4 — Expert comment generator
 *
 * Generates LinkedIn comments that are indistinguishable from a human
 * expert's writing. This is the core differentiator: the comment must
 * read like a thoughtful practitioner typing on their phone during a
 * commute, not like ChatGPT summarizing a topic.
 *
 * Anti-detection rules (enforced both at prompt-level and post-processing):
 *
 *   1. NO AI TICS — none of these phrases may appear:
 *      "Great point!", "Spot on!", "I completely agree", "Absolutely!",
 *      "Couldn't agree more", "Well said", "This is so true",
 *      "What a great article", "Thanks for sharing", "Love this!",
 *      "100%", "This!", "So true", "Indeed", "Exactly this"
 *
 *   2. NO EMOJIS (already enforced by R-012 sanitizer, double-checked here)
 *
 *   3. NO BULLET LISTS — comments are prose, never "- item\n- item"
 *
 *   4. NO EM-DASHES — use regular hyphens or commas instead.
 *      Em-dashes are a ChatGPT tell.
 *
 *   5. VARIED SENTENCE LENGTH — mix of short (3-5 words) and longer
 *      (10-20 words) sentences. Never three long sentences in a row.
 *
 *   6. VARIED OPENING — don't always start with "I" or "This".
 *      Open with a fact, a number, a question, an observation, a
 *      counter-point, or a micro-anecdote.
 *
 *   7. ONE SPECIFIC MICRO-DETAIL — include a number, a name, a date,
 *      a tool name, or a counter-intuitive observation. This is the
 *      single most important anti-detection signal.
 *
 *   8. NO SUPERLATIVES — avoid "amazing", "incredible", "game-changing",
 *      "revolutionary", "groundbreaking". Use neutral adjectives.
 *
 *   9. 2-4 SENTENCES MAX — never longer. Real LinkedIn comments are short.
 *
 *  10. OPINIONATED — take a position. Don't sit on the fence. The
 *      comment should add a viewpoint, not just agree.
 *
 * Tone options:
 *   - expert:        analytical, opinionated, adds a data point
 *   - analytical:    breaks down the post's claim with structure
 *   - contrarian:    politely disagrees with one specific point
 *   - casual:        conversational, shorter, references personal experience
 *
 * Server-side only — uses z-ai-web-dev-sdk directly via serverChatCompletion.
 */
import { serverChatCompletion } from "@/lib/server-ai-client";
import { stripEmojis } from "@/lib/sanitize-text";
import { createLogger } from "@/lib/logger";

const log = createLogger("expert-comment");

export type ExpertTone = "expert" | "analytical" | "contrarian" | "casual";

export interface ExpertCommentInput {
  /** The text of the LinkedIn post we're commenting on. */
  postText: string;
  /** Author name (optional, helps personalize). */
  postAuthor?: string;
  /** Author role/headline (optional). */
  postAuthorRole?: string;
  /** Tone of the comment. */
  tone?: ExpertTone;
  /** The user's niche/context (e.g. "B2B SaaS, AI agents, growth"). */
  userContext?: string;
  /** The user's ICP sectors, used to find a relevant angle. */
  icpSectors?: string[];
}

export interface ExpertCommentOutput {
  /** The generated comment text, sanitized. */
  text: string;
  /** The tone used. */
  tone: ExpertTone;
  /** The model that generated it. */
  model: string;
  /** Detection of any anti-pattern violations that were auto-fixed. */
  fixedViolations: string[];
}

/**
 * AI tics that MUST NOT appear in the comment. These are the most common
 * "tells" that reveal AI-generated LinkedIn comments. We check both the
 * raw output and after sanitization.
 */
const AI_TICS = [
  /\bgreat point\b/i,
  /\bspot on\b/i,
  /\bi completely agree\b/i,
  /\bi absolutely agree\b/i,
  /\bcouldn'?t agree more\b/i,
  /\bwell said\b/i,
  /\bthis is so true\b/i,
  /\bwhat a great (article|post|read)\b/i,
  /\bthanks for sharing\b/i,
  /\blove this\b/i,
  /\bthis!\b/i,
  /\bso true\b/i,
  /\bindeed\b/i,
  /\bexactly this\b/i,
  /\babsolutely!\b/i,
  /\b100%/,
  /\bnail(ed)? it\b/i,
  /\bhit the nail\b/i,
  /\byou hit the\b/i,
  /\bfood for thought\b/i,
  /\bgreat insights?\b/i,
  /\bvaluable insights?\b/i,
  /\binvaluable\b/i,
  /\bgame[- ]?changer\b/i,
  /\brevolutionary\b/i,
  /\bgroundbreaking\b/i,
  /\bamazing\b/i,
  /\bincredible\b/i,
  /\bawesome\b/i,
  /\bfascinating\b/i,
  /\bremarkable\b/i,
];

/**
 * Post-process the AI output to remove any violations of the anti-detection
 * rules. Returns the cleaned text and a list of violations that were fixed.
 *
 * This is a defense-in-depth layer: even if the model disobeys the prompt,
 * we catch the most obvious tells here.
 */
export function sanitizeExpertComment(raw: string): { text: string; fixedViolations: string[] } {
  const fixed: string[] = [];
  let text = raw;

  // 1. Strip emojis (R-012)
  const beforeEmoji = text;
  text = stripEmojis(text);
  if (beforeEmoji !== text) fixed.push("emojis_removed");

  // 2. Replace em-dashes with regular hyphens (ChatGPT tell)
  if (/—|--/.test(text)) {
    text = text.replace(/—/g, "-").replace(/--/g, "-");
    fixed.push("em_dashes_replaced");
  }

  // 3. Remove AI tics by deleting the matching phrase entirely.
  // We don't try to replace them because the surrounding sentence often
  // doesn't make sense without a rewrite. Better to just remove the tic
  // and let the rest of the comment stand.
  for (const tic of AI_TICS) {
    if (tic.test(text)) {
      // Remove the tic + any trailing punctuation/whitespace
      text = text.replace(new RegExp(tic.source + "[.,!?:;\\s]*", "gi"), "");
      fixed.push(`tic_removed:${tic.source}`);
    }
  }

  // 4. Collapse multiple spaces / newlines created by the removals
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  // 5. Fix leading orphan punctuation (", and..." → "And...")
  text = text.replace(/^[\s,.;:!?]+/, "");

  // 6. Capitalize the first letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // 7. Ensure trailing punctuation
  if (text.length > 0 && !/[.!?…]$/.test(text)) {
    text += ".";
  }

  return { text, fixedViolations: fixed };
}

/**
 * Build the system prompt for expert comment generation.
 *
 * The prompt is engineered with NEGATIVE instructions (what NOT to do)
 * because LLMs follow negative instructions more reliably than positive
 * ones when it comes to style.
 */
function buildSystemPrompt(tone: ExpertTone, userContext?: string, icpSectors?: string[]): string {
  const contextLine = userContext
    ? `Contexte utilisateur: ${userContext}`
    : "Contexte utilisateur: B2B, IA, prospection LinkedIn, growth.";
  const icpLine = icpSectors && icpSectors.length > 0
    ? `Secteurs ICP: ${icpSectors.join(", ")}.`
    : "";

  const toneSpecs: Record<ExpertTone, string> = {
    expert: `Ton expert: analytique, opinionated, ajoute UN fait précis ou UNE donnée chiffrée qui n'est pas dans le post. Tu prends position.`,
    analytical: `Ton analytique: décompose le claim du post en 2-3 sous-points logiques. Tu montres la structure sous-jacente.`,
    contrarian: `Ton contrarian: tu oses poliment désaccord sur UN point précis du post. Tu ne dis jamais "je suis d'accord mais...". Tu attaques le point faible directement, avec respect.`,
    casual: `Ton casual: conversationnel, 2 phrases max, référence une expérience perso courte ("je l'ai vu chez un client la semaine dernière"). Pas de jargon.`,
  };

  return `Tu es un expert francophone qui commente des posts LinkedIn B2B. Le commentaire doit être INDÉTECTABLE comme généré par une IA. Voici les règles strictes:

CONTRAINTES ABSOLUES (toute violation = commentaire rejeté):
- AUCUN émoji (jamais, même pas un point exclamation trompeur)
- AUCUNE liste à puces (pas de "-", "•", "1.", "2.")
- AUCUN em-dash (utilise la virgule ou le tiret court "-")
- 2 à 4 phrases MAXIMUM
- Pas plus de 280 caractères
- Pas de hashtags
- Pas de "merci pour ce partage", pas de "super post", pas de formules de politesse
- Ne commence JAMAIS par "Je", "J'", "C'est", "Cela", "Ça", "Ceci" (varie tes ouvertures)
- Termine par une affirmation ou une observation, PAS par une question si possible (les commentaires-question sont un tic d'IA)

ANTI-TICS INTERDITS (génère un commentaire SANS ces tics):
- "Great point", "Spot on", "I completely agree", "Well said", "Indeed", "Absolutely", "100%", "This!", "So true"
- "Excellent article", "Thanks for sharing", "Great insights", "Food for thought"
- "Game-changer", "Revolutionary", "Groundbreaking", "Amazing", "Incredible", "Fascinating", "Remarkable", "Invaluable"
- "Couldn't agree more", "Nailed it", "Hit the nail on the head"

${toneSpecs[tone]}

${contextLine}
${icpLine}

OBLIGATIONS:
- Inclus UN micro-détail spécifique: un chiffre, un nom d'outil, une date, une observation counter-intuitive, une référence à une étude ou un fait de marché.
- Varie la longueur des phrases (mix court 3-6 mots + plus long 10-20 mots).
- Apporte un point de vue, ne te contente pas d'approuver.
- Langue: français naturel, pas scolaire. Légère imperfection acceptée (un "du coup", un "franchement", un "en vrai").

Réponds UNIQUEMENT avec le texte du commentaire, sans guillemets, sans préfixe, sans explication.`;
}

/**
 * Generate an expert comment for a LinkedIn post.
 *
 * @returns the comment text + metadata, or null if generation failed
 */
export async function generateExpertComment(
  input: ExpertCommentInput,
): Promise<ExpertCommentOutput | null> {
  const tone: ExpertTone = input.tone ?? "expert";

  const userMessage = [
    `Post de ${input.postAuthor ?? "un auteur"}${input.postAuthorRole ? ` (${input.postAuthorRole})` : ""}:`,
    "",
    `"${input.postText.slice(0, 1200)}"`,
    "",
    "Génère UN commentaire en français, dans le ton demandé, qui passe le test anti-IA.",
  ].join("\n");

  const messages = [
    {
      role: "system" as const,
      content: buildSystemPrompt(tone, input.userContext, input.icpSectors),
    },
    {
      role: "user" as const,
      content: userMessage,
    },
  ];

  try {
    const response = await serverChatCompletion(messages, {
      temperature: 0.85, // slightly higher than default to escape the model's most-likely phrasings
      maxTokens: 220,
    });

    if (!response.content || response.content.trim().length === 0) {
      log.warn("Expert comment generation returned empty content");
      return null;
    }

    // Post-process to remove any anti-detection violations
    const { text, fixedViolations } = sanitizeExpertComment(response.content);

    if (text.length < 30) {
      log.warn("Expert comment too short after sanitization", {
        original: response.content,
        sanitized: text,
      });
      return null;
    }

    // Final sanity check: re-run tic detection on the sanitized text
    const remainingTics = AI_TICS.filter((tic) => tic.test(text));
    if (remainingTics.length > 0) {
      log.warn("Expert comment still has tics after sanitization, rejecting", {
        tics: remainingTics.map((t) => t.source),
        text,
      });
      return null;
    }

    return {
      text,
      tone,
      model: response.model,
      fixedViolations,
    };
  } catch (err) {
    log.error("Expert comment generation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Generate multiple expert comments in different tones, so the user can
 * pick their favorite before posting (when running interactively).
 *
 * @returns array of up to `count` distinct comments
 */
export async function generateExpertCommentVariants(
  input: Omit<ExpertCommentInput, "tone">,
  count: number = 3,
): Promise<ExpertCommentOutput[]> {
  const tones: ExpertTone[] = ["expert", "analytical", "contrarian", "casual"];
  const selectedTones = tones.slice(0, Math.min(count, tones.length));

  const results = await Promise.allSettled(
    selectedTones.map((tone) => generateExpertComment({ ...input, tone })),
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<ExpertCommentOutput | null> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((v): v is ExpertCommentOutput => v !== null);
}
