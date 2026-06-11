import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";

/**
 * Upload an image to LinkedIn and register it for use in a post.
 * LinkedIn's media upload is a 2-step process:
 * 1. Register the image upload to get an upload URL
 * 2. Upload the binary image data to that URL
 * 3. The image is then available for use in a post
 */
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
    const { imageBase64, linkedinId } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "L'image (base64) est requise" },
        { status: 400 }
      );
    }

    if (!linkedinId) {
      return NextResponse.json(
        { error: "L'ID LinkedIn est requis" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Step 1: Register the image upload
    const registerResponse = await fetch(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: `urn:li:person:${linkedinId}`,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        }),
      }
    );

    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      console.error(
        "LinkedIn register upload failed:",
        registerResponse.status,
        errorText
      );

      if (registerResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Token expiré. Reconnectez votre compte LinkedIn.",
            tokenExpired: true,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Erreur lors de l'enregistrement de l'image sur LinkedIn" },
        { status: registerResponse.status }
      );
    }

    const registerData = await registerResponse.json();
    const uploadUrl =
      registerData.value?.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl;
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
      console.error("Missing uploadUrl or asset:", registerData);
      return NextResponse.json(
        { error: "Réponse LinkedIn invalide pour l'upload d'image" },
        { status: 500 }
      );
    }

    // Step 2: Upload the binary image data
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "image/png",
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(
        "LinkedIn image upload failed:",
        uploadResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: "Erreur lors du transfert de l'image vers LinkedIn" },
        { status: uploadResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      asset,
      message: "Image uploadée avec succès sur LinkedIn",
    });
  } catch (error) {
    console.error("LinkedIn image upload error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
