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
    const { text, visibility = "PUBLIC", linkedinId } = body;

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
