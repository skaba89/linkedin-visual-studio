import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, size = "1024x1024" } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Le prompt de l'image est requis" },
        { status: 400 }
      );
    }

    const validSizes = [
      "1024x1024",
      "768x1344",
      "864x1152",
      "1344x768",
      "1152x864",
      "1440x720",
      "720x1440",
    ];

    const selectedSize = validSizes.includes(size) ? size : "1024x1024";

    const zai = await ZAI.create();

    const response = await zai.images.generations.create({
      prompt: prompt.trim(),
      size: selectedSize as "1024x1024",
    });

    const imageBase64 = response.data[0]?.base64;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Impossible de générer l'image" },
        { status: 500 }
      );
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Return as image/png with base64 data
    return NextResponse.json({
      success: true,
      imageBase64,
      prompt,
      size: selectedSize,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'image" },
      { status: 500 }
    );
  }
}
