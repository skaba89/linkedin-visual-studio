import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookies } from "@/lib/linkedin-token";

/**
 * Upload a PDF document to LinkedIn for carousel display.
 * LinkedIn displays PDFs as swipeable carousel slides.
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
    const { pdfBase64, linkedinId } = body;

    if (!pdfBase64) {
      return NextResponse.json(
        { error: "Le PDF (base64) est requis" },
        { status: 400 }
      );
    }

    if (!linkedinId) {
      return NextResponse.json(
        { error: "L'ID LinkedIn est requis" },
        { status: 400 }
      );
    }

    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Step 1: Register the document upload
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
            recipes: ["urn:li:digitalmediaRecipe:feedshare-document"],
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
        "LinkedIn document register failed:",
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
        { error: "Erreur lors de l'enregistrement du document sur LinkedIn" },
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
        { error: "Réponse LinkedIn invalide pour l'upload du document" },
        { status: 500 }
      );
    }

    // Step 2: Upload the PDF binary data
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/pdf",
      },
      body: pdfBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(
        "LinkedIn document upload failed:",
        uploadResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: "Erreur lors du transfert du document vers LinkedIn" },
        { status: uploadResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      asset,
      message: "Document carrousel uploadé avec succès sur LinkedIn",
    });
  } catch (error) {
    console.error("LinkedIn document upload error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
