import { NextRequest, NextResponse } from "next/server";
import { generateCarouselPDF, generateSlidePNG, type CarouselData, type CarouselSlide, type CarouselStyle } from "@/lib/carousel-generator";
import { generateCarouselContent, type CarouselSlideData } from "@/lib/linkedin-ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postText, topicTitle, authorName, authorTitle, style = "dark_pro", primaryColor, accentColor } = body;

    if (!postText || !postText.trim()) {
      return NextResponse.json(
        { error: "Le texte du post est requis" },
        { status: 400 }
      );
    }

    // Step 1: Generate carousel content via AI
    const slidesData: CarouselSlideData[] = await generateCarouselContent(
      postText.trim(),
      topicTitle
    );

    // Step 2: Map to carousel generator format
    const slides: CarouselSlide[] = slidesData.map((s) => ({
      type: s.type,
      headline: s.headline,
      body: s.body,
      accent: s.accent,
      bullets: s.bullets,
      stat: s.stat,
    }));

    // Step 3: Build carousel data
    const carouselData: CarouselData = {
      slides,
      authorName: authorName || "HERMÈS",
      authorTitle: authorTitle || "Data & IA",
      style: style as CarouselStyle,
      primaryColor: primaryColor || "#3B82F6",
      accentColor: accentColor || "#8B5CF6",
    };

    // Step 4: Generate PDF
    const pdfBuffer = await generateCarouselPDF(carouselData);

    // Step 5: Return as base64 for client-side preview and upload
    const pdfBase64 = pdfBuffer.toString("base64");

    // Also generate preview of first slide as PNG
    const previewBuffer = await generateSlidePNG(slides[0], carouselData, 1, slides.length);
    const previewBase64 = previewBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      slideCount: slides.length,
      pdfBase64,
      previewBase64,
      slides: slidesData,
      style,
      message: `Carrousel ${slides.length} slides généré avec succès`,
    });
  } catch (error) {
    console.error("Carousel generation error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du carrousel" },
      { status: 500 }
    );
  }
}
