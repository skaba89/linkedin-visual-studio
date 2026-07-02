/**
 * HERMÈS — Phase 6.1 — /api/data/engagement-settings/preview-comment
 *
 * POST: generate a humanized comment preview for a given post text.
 *
 * Uses the user's engagement settings (tone, voice samples, humanization
 * toggle) to run the multi-pass humanization pipeline. Returns the best
 * comment found, with its humanness score and pass count.
 *
 * Body:
 *   { postText: string, postAuthor?: string, postAuthorRole?: string }
 *
 * Response:
 *   { comment: string, tone, model, passes, humannessScore, voiceFingerprintApplied }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleRouteError } from "@/lib/http-error";
import { parseJsonField } from "@/lib/json-field";
import { generateHumanizedComment } from "@/lib/linkedin/comment-humanizer";
import { generateExpertComment, type ExpertTone } from "@/lib/linkedin/expert-comment";

const VALID_TONES = ["expert", "analytical", "contrarian", "casual"];

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (!body.postText || typeof body.postText !== "string" || body.postText.trim().length < 10) {
      return NextResponse.json(
        { error: "Le champ 'postText' est requis (min 10 caractères)" },
        { status: 400 },
      );
    }

    // Load user settings
    const settings = await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });

    const tone: ExpertTone = VALID_TONES.includes(settings.engagementTone)
      ? (settings.engagementTone as ExpertTone)
      : "expert";

    const voiceSamples = parseJsonField<string[]>(settings.engagementVoiceSamples, []);

    // Use humanization pipeline if enabled, else single-pass generation
    if (settings.engagementHumanization) {
      const result = await generateHumanizedComment(
        {
          postText: body.postText,
          postAuthor: body.postAuthor,
          postAuthorRole: body.postAuthorRole,
          tone,
        },
        voiceSamples.length >= 3 ? voiceSamples : undefined,
      );

      if (!result) {
        return NextResponse.json(
          { error: "Échec de génération après humanisation" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        comment: result.text,
        tone: result.tone,
        model: result.model,
        passes: result.passes,
        humannessScore: result.humannessScore,
        voiceFingerprintApplied: result.voiceFingerprintApplied,
      });
    } else {
      // Single-pass legacy generation
      const result = await generateExpertComment({
        postText: body.postText,
        postAuthor: body.postAuthor,
        postAuthorRole: body.postAuthorRole,
        tone,
      });

      if (!result) {
        return NextResponse.json(
          { error: "Échec de génération du commentaire" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        comment: result.text,
        tone: result.tone,
        model: result.model,
        passes: 1,
        humannessScore: null,
        voiceFingerprintApplied: false,
      });
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
