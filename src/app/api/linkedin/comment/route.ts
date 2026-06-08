import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";

export async function POST(request: NextRequest) {
  try {
    const token = await getTokenFromCookies();

    if (!token) {
      return NextResponse.json(
        { error: "Non authentifié. Connectez votre compte LinkedIn." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postUrn, text, linkedinId } = body;

    if (!postUrn) {
      return NextResponse.json(
        { error: "L'URN du post est requis" },
        { status: 400 }
      );
    }

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Le texte du commentaire est requis" },
        { status: 400 }
      );
    }

    const commentBody = {
      actor: `urn:li:person:${linkedinId}`,
      object: postUrn,
      message: {
        text: text.trim(),
      },
    };

    const commentResponse = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commentBody),
      }
    );

    if (!commentResponse.ok) {
      const errorText = await commentResponse.text();
      console.error("LinkedIn comment failed:", commentResponse.status, errorText);

      if (commentResponse.status === 401) {
        return NextResponse.json(
          { error: "Token expiré. Reconnectez votre compte LinkedIn.", tokenExpired: true },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Erreur lors du commentaire sur LinkedIn" },
        { status: commentResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Commentaire publié avec succès",
    });
  } catch (error) {
    console.error("LinkedIn comment error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
