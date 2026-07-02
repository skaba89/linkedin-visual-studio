/**
 * HERMÈS — Phase 6.1 — Comment Humanizer v3
 *
 * Multi-pass self-evaluation pipeline that scores each generated comment
 * on 5 humanness criteria and regenerates if the score is below threshold.
 *
 * The previous expert-comment.ts generated ONE comment and ran a regex-based
 * sanitizer. This module adds a SECOND LLM pass that audits the comment
 * like a human reader would, plus a THIRD regeneration pass with feedback.
 *
 * Pipeline:
 *   1. Generate initial comment (existing generateExpertComment)
 *   2. Score on 5 criteria via audit LLM call (cheap model, fast)
 *   3. If score >= threshold → return
 *   4. If score < threshold → regenerate with explicit feedback
 *   5. Repeat up to MAX_PASSES times
 *
 * Humanness scoring criteria (each 0-10):
 *   - openingVariation: does it start with something other than "I/This/C'"?
 *   - specificity: contains a concrete micro-detail (number, name, tool)?
 *   - sentenceRhythm: mix of short + long sentences?
 *   - vocabularyNaturalness: no AI tics, no school-French, slight imperfection?
 *   - opinionStrength: takes a position, doesn't just agree?
 *
 * Voice Fingerprint:
 *   When the user provides 3-5 of their own LinkedIn comments, we extract
 *   their voice signature (avg sentence length, favorite openers, vocabulary
 *   tics, punctuation habits) and inject it into the prompt. The model then
 *   mimics THEIR voice rather than a generic "expert" voice.
 *
 * Server-side only.
 */
import { serverChatCompletion } from "@/lib/server-ai-client";
import { createLogger } from "@/lib/logger";
import {
  generateExpertComment,
  sanitizeExpertComment,
  type ExpertCommentInput,
  type ExpertCommentOutput,
  type ExpertTone,
} from "@/lib/linkedin/expert-comment";

const log = createLogger("comment-humanizer");

const MAX_PASSES = 3;
const HUMANNESS_THRESHOLD = 7.5; // out of 10

export interface VoiceFingerprint {
  /** Average sentence length in characters. */
  avgSentenceLength: number;
  /** Favorite opening words (first 1-2 words of comments). */
  preferredOpeners: string[];
  /** Vocabulary the user favors (frequency-sorted, top 20). */
  favoredVocabulary: string[];
  /** Punctuation habits: ratio of "." vs "!" vs "?" sentence endings. */
  punctuationProfile: { period: number; exclamation: number; question: number };
  /** Whether the user uses first-person ("je", "j'") frequently. */
  usesFirstPerson: boolean;
  /** Sample length range (min/max characters). */
  lengthRange: { min: number; max: number };
  /** Raw sample (for few-shot injection). */
  samples: string[];
}

export interface HumannessScore {
  openingVariation: number;
  specificity: number;
  sentenceRhythm: number;
  vocabularyNaturalness: number;
  opinionStrength: number;
  overall: number;
  feedback: string[];
}

export interface HumanizedCommentOutput extends ExpertCommentOutput {
  passes: number;
  humannessScore: HumannessScore;
  voiceFingerprintApplied: boolean;
}

/**
 * Extract a voice fingerprint from a set of real user comments.
 *
 * The fingerprint is intentionally lightweight — we extract statistical
 * features that the LLM can mimic, not full style transfer (which would
 * require fine-tuning).
 */
export function extractVoiceFingerprint(samples: string[]): VoiceFingerprint | null {
  const clean = samples
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 500);
  if (clean.length < 3) return null;

  // Average sentence length
  const allSentences = clean.flatMap((s) =>
    s.split(/[.!?]+/).map((x) => x.trim()).filter((x) => x.length > 0),
  );
  const avgSentenceLength =
    allSentences.reduce((sum, s) => sum + s.length, 0) / Math.max(allSentences.length, 1);

  // Preferred openers (first 1-2 words)
  const openerCounts = new Map<string, number>();
  for (const s of clean) {
    const firstWords = s.split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    openerCounts.set(firstWords, (openerCounts.get(firstWords) ?? 0) + 1);
  }
  const preferredOpeners = Array.from(openerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([opener]) => opener);

  // Favored vocabulary (words appearing in multiple samples)
  const wordCounts = new Map<string, number>();
  for (const s of clean) {
    const words = new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\s']/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4),
    );
    for (const w of words) {
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
    }
  }
  const favoredVocabulary = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  // Punctuation profile
  let period = 0, exclamation = 0, question = 0;
  for (const s of clean) {
    if (/\.$/.test(s.trim())) period++;
    if (/!$/.test(s.trim())) exclamation++;
    if (/\?$/.test(s.trim())) question++;
  }
  const total = period + exclamation + question || 1;
  const punctuationProfile = {
    period: period / total,
    exclamation: exclamation / total,
    question: question / total,
  };

  // First-person usage
  const firstPersonCount = clean.filter((s) => /\b(je|j'|j’|moi|mon|ma|mes)\b/i.test(s)).length;
  const usesFirstPerson = firstPersonCount / clean.length >= 0.5;

  // Length range
  const lengths = clean.map((s) => s.length).sort((a, b) => a - b);
  const lengthRange = {
    min: lengths[0] ?? 50,
    max: lengths[lengths.length - 1] ?? 280,
  };

  return {
    avgSentenceLength: Math.round(avgSentenceLength),
    preferredOpeners,
    favoredVocabulary,
    punctuationProfile,
    usesFirstPerson,
    lengthRange,
    samples: clean.slice(0, 5),
  };
}

/**
 * Score a comment on 5 humanness criteria via an audit LLM call.
 *
 * The audit prompt asks for a JSON response with 5 numeric scores (0-10)
 * and an array of specific feedback strings. We use a low temperature to
 * keep the scoring deterministic.
 */
export async function scoreCommentHumanness(
  comment: string,
  postText: string,
): Promise<HumannessScore> {
  const systemPrompt = `Tu es un auditeur qui évalue si un commentaire LinkedIn a été écrit par un humain ou par une IA. Tu scores le commentaire sur 5 critères (0-10 chacun).

Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication hors JSON. Format:
{
  "openingVariation": <0-10>,  // 10 si l'ouverture est originale, 0 si "Je/This/C'"
  "specificity": <0-10>,       // 10 si micro-détail chiffré/nommé, 0 si générique
  "sentenceRhythm": <0-10>,    // 10 si mix court/long, 0 si uniforme
  "vocabularyNaturalness": <0-10>, // 10 si français naturel, 0 si tics IA/scolaire
  "opinionStrength": <0-10>,   // 10 si prend position, 0 si juste approuver
  "feedback": ["<feedback court 1>", "<feedback court 2>"]
}`;

  const userPrompt = `Post commenté:
"${postText.slice(0, 600)}"

Commentaire à évaluer:
"${comment}"

Évalue ce commentaire sur les 5 critères. Sois sévère: un commentaire moyen doit scorer 5-6, un bon commentaire 7-8, un excellent 9-10. Tout ce qui ressemble à du ChatGPT doit scorer < 5.`;

  try {
    const response = await serverChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 400 },
    );

    // Parse JSON — be lenient about markdown wrapping
    const jsonStr = response.content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonStr) as Partial<HumannessScore>;

    const clamp = (n: unknown): number => {
      const num = typeof n === "number" ? n : parseFloat(String(n));
      if (isNaN(num)) return 5;
      return Math.max(0, Math.min(10, num));
    };

    const openingVariation = clamp(parsed.openingVariation);
    const specificity = clamp(parsed.specificity);
    const sentenceRhythm = clamp(parsed.sentenceRhythm);
    const vocabularyNaturalness = clamp(parsed.vocabularyNaturalness);
    const opinionStrength = clamp(parsed.opinionStrength);
    const overall =
      (openingVariation + specificity + sentenceRhythm + vocabularyNaturalness + opinionStrength) /
      5;

    const feedback = Array.isArray(parsed.feedback)
      ? parsed.feedback.filter((f): f is string => typeof f === "string").slice(0, 5)
      : [];

    return {
      openingVariation,
      specificity,
      sentenceRhythm,
      vocabularyNaturalness,
      opinionStrength,
      overall: Math.round(overall * 10) / 10,
      feedback,
    };
  } catch (err) {
    log.warn("Humanness scoring failed, returning neutral score", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      openingVariation: 5,
      specificity: 5,
      sentenceRhythm: 5,
      vocabularyNaturalness: 5,
      opinionStrength: 5,
      overall: 5,
      feedback: ["audit_failed"],
    };
  }
}

/**
 * Build a regeneration prompt that incorporates:
 *   - The original post
 *   - The previous comment attempt
 *   - The audit feedback (specific weaknesses to fix)
 *   - The user's voice fingerprint (if available)
 */
function buildRegenerationPrompt(
  input: ExpertCommentInput,
  previousComment: string,
  score: HumannessScore,
  voice?: VoiceFingerprint,
): string {
  const tone: ExpertTone = input.tone ?? "expert";

  const feedbackLines = score.feedback.length > 0
    ? score.feedback.map((f) => `- ${f}`).join("\n")
    : "- Améliore la naturalité générale";

  const voiceLine = voice
    ? `\nEMPREINTE VOCALE DE L'UTILISATEUR (imite-la précisément):
- Longueur moyenne de phrase: ${voice.avgSentenceLength} caractères
- Ouvertures préférées: ${voice.preferredOpeners.join(" / ") || "variées"}
- Vocabulaire favori (réutilise si pertinent): ${voice.favoredVocabulary.slice(0, 10).join(", ") || "N/A"}
- Ponctuation: ${Math.round(voice.punctuationProfile.period * 100)}% point, ${Math.round(voice.punctuationProfile.exclamation * 100)}% exclamation, ${Math.round(voice.punctuationProfile.question * 100)}% question
- Utilise la première personne: ${voice.usesFirstPerson ? "oui" : "non"}
- Longueur cible: ${voice.lengthRange.min}-${voice.lengthRange.max} caractères

EXEMPLES DE TON ÉCRITURE RÉELLE (imite le style):
${voice.samples.map((s) => `• ${s.slice(0, 200)}`).join("\n")}`
    : "";

  return `Post de ${input.postAuthor ?? "un auteur"}:
"${input.postText.slice(0, 1000)}"

Ton précédent commentaire (score: ${score.overall}/10):
"${previousComment}"

FEEDBACK DE L'AUDIT:
${feedbackLines}

Scores détaillés:
- Ouverture: ${score.openingVariation}/10
- Spécificité: ${score.specificity}/10
- Rythme: ${score.sentenceRhythm}/10
- Vocabulaire: ${score.vocabularyNaturalness}/10
- Opinion: ${score.opinionStrength}/10
${voiceLine}

Ton: ${tone}

Régénère le commentaire en corrigeant TOUS les points faibles soulignés par l'audit. Vise un score global de 8/10 minimum. Réponds UNIQUEMENT avec le texte du commentaire, sans guillemets ni explication.`;
}

/**
 * Run the multi-pass humanization pipeline.
 *
 * @param input the comment generation input
 * @param voiceSamples optional real user comments for voice fingerprinting
 * @returns the best comment found, with score + pass count
 */
export async function generateHumanizedComment(
  input: ExpertCommentInput,
  voiceSamples?: string[],
): Promise<HumanizedCommentOutput | null> {
  const voice = voiceSamples && voiceSamples.length >= 3
    ? extractVoiceFingerprint(voiceSamples)
    : null;

  let bestComment: ExpertCommentOutput | null = null;
  let bestScore: HumannessScore | null = null;
  let bestPass = 0;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    log.info("Humanization pass", { pass, hasVoice: !!voice });

    let comment: ExpertCommentOutput | null;

    if (pass === 1) {
      // First pass: standard generation
      comment = await generateExpertComment({
        ...input,
        ...(voice ? { userContext: `${input.userContext ?? ""}\nVoice fingerprint: ${voice.preferredOpeners.join("/")}` } : {}),
      });
    } else {
      // Subsequent passes: regeneration with feedback
      if (!bestComment || !bestScore) break;

      const regenPrompt = buildRegenerationPrompt(input, bestComment.text, bestScore, voice ?? undefined);
      try {
        const response = await serverChatCompletion(
          [
            {
              role: "system",
              content: "Tu es un expert francophone qui régénère un commentaire LinkedIn pour qu'il soit indétectable comme IA. Réponds uniquement avec le texte du commentaire.",
            },
            { role: "user", content: regenPrompt },
          ],
          { temperature: 0.9, maxTokens: 220 },
        );

        if (!response.content || response.content.trim().length === 0) {
          log.warn("Regeneration returned empty content", { pass });
          continue;
        }

        const { text, fixedViolations } = sanitizeExpertComment(response.content);
        if (text.length < 30) {
          log.warn("Regenerated comment too short", { pass, length: text.length });
          continue;
        }

        comment = {
          text,
          tone: input.tone ?? "expert",
          model: response.model,
          fixedViolations,
        };
      } catch (err) {
        log.error("Regeneration failed", { pass, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
    }

    if (!comment) continue;

    // Score the comment
    const score = await scoreCommentHumanness(comment.text, input.postText);
    log.info("Pass scored", { pass, score: score.overall });

    if (!bestScore || score.overall > bestScore.overall) {
      bestComment = comment;
      bestScore = score;
      bestPass = pass;
    }

    // If we hit the threshold, stop early
    if (score.overall >= HUMANNESS_THRESHOLD) {
      log.info("Threshold reached, stopping early", { pass, score: score.overall });
      break;
    }
  }

  if (!bestComment || !bestScore) {
    return null;
  }

  return {
    ...bestComment,
    passes: bestPass,
    humannessScore: bestScore,
    voiceFingerprintApplied: !!voice,
  };
}
