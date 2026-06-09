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
    const { postUrn, linkedinId } = body;

    if (!postUrn) {
      return NextResponse.json(
        { error: "L'URN du post est requis" },
        { status: 400 }
      );
    }

    const likeBody = {
      actor: `urn:li:person:${linkedinId}`,
      object: postUrn,
    };

    const likeResponse = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/likes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(likeBody),
      }
    );

    if (!likeResponse.ok) {
      const errorText = await likeResponse.text();
      console.error("LinkedIn like failed:", likeResponse.status, errorText);

      if (likeResponse.status === 401) {
        return NextResponse.json(
          { error: "Token expiré. Reconnectez votre compte LinkedIn.", tokenExpired: true },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Erreur lors du like sur LinkedIn" },
        { status: likeResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Post liké avec succès",
    });
  } catch (error) {
    console.error("LinkedIn like error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
