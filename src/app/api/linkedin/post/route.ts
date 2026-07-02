import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";
import { stripEmojis } from "@/lib/sanitize-text";
import {
  guardLinkedInAction,
  complianceBlockedResponse,
} from "@/lib/linkedin/compliance-guard";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const token = await getTokenFromCookies();

    if (!token) {
      return NextResponse.json(
        { error: "Non authentifié. Connectez votre compte LinkedIn." },
        { status: 401 }
      );
    }

    // ─── Compliance pre-flight check ───────────────────────────────────
    // Block the call BEFORE hitting LinkedIn if the user has reached their
    // daily post limit. Prevents LinkedIn from flagging the account as
    // automated spam and banning it.
    const guard = await guardLinkedInAction("post");
    if (!guard.allowed) {
      if (guard.reason === "AUTH_REQUIRED") {
        return NextResponse.json(
          { error: "Authentification HERMÈS requise" },
          { status: 401 },
        );
      }
      return complianceBlockedResponse(guard.reason ?? "Limite quotidienne atteinte");
    }

    const body = await request.json();
    // R-012 — sanitize emojis BEFORE sending to LinkedIn, even if the text
    // was hand-typed by the user. This is the last line of defense.
    const text = stripEmojis(body.text);
    const visibility = body.visibility || "PUBLIC";
    const linkedinId = body.linkedinId;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Le texte du post est requis" },
        { status: 400 }
      );
    }

    if (!linkedinId) {
      return NextResponse.json(
        { error: "L'ID LinkedIn est requis" },
        { status: 400 }
      );
    }

    const postBody = {
      author: `urn:li:person:${linkedinId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: text.trim(),
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility === "CONNECTIONS" ? "CONNECTIONS" : "PUBLIC",
      },
    };

    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error("LinkedIn post creation failed:", postResponse.status, errorText);

      if (postResponse.status === 401) {
        return NextResponse.json(
          { error: "Token expiré. Reconnectez votre compte LinkedIn.", tokenExpired: true },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Erreur lors de la publication sur LinkedIn" },
        { status: postResponse.status }
      );
    }

    const responseData = await postResponse.json();

    // ─── Persist the LinkedIn URN so the metrics sync cron can fetch
    // likes/comments later. We store it on a LinkedInPost row — if the
    // user wants to track performance, they need this URN stored.
    // Fire-and-forget so we don't block the success response.
    const postUrn = responseData?.activity || responseData?.id || "";
    if (postUrn) {
      try {
        const user = await requireUser();
        await db.linkedInPost.create({
          data: {
            userId: user.id,
            text: text.trim(),
            visibility,
            linkedinUrn: postUrn,
          },
        });
      } catch (err) {
        console.error("[linkedin-post] Failed to persist LinkedInPost row:", err);
      }
    }

    // ─── Compliance: record successful action ──────────────────────────
    // Increment the per-user daily post counter so the next call can be
    // checked against the limit. Fire-and-forget — don't block the response
    // on a DB write. Errors are logged but not surfaced to the client.
    guard.record().catch((err) => {
      console.error("[compliance] Failed to record post action:", err);
    });

    return NextResponse.json({
      success: true,
      postId: responseData.id,
      message: "Post publié avec succès sur LinkedIn",
    });
  } catch (error) {
    console.error("LinkedIn post error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
