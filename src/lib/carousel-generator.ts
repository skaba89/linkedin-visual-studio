/**
 * Professional LinkedIn Carousel Generator
 * 
 * Creates multi-slide PDF carousels from post content — the #1 format for LinkedIn engagement.
 * Uses SVG templates → Sharp (PNG) → PDF-Lib assembly pipeline.
 * 
 * Supported styles:
 * - dark_pro:    Dark background, white text, blue accents (most popular on LinkedIn)
 * - clean_light: White background, dark text, subtle color accents
 * - gradient:    Bold gradient backgrounds, white text
 * - minimal:     Ultra-clean, lots of whitespace, typography-focused
 */

import { PDFDocument } from "pdf-lib";

// ─── Types ──────────────────────────────────────────────────────

export type CarouselStyle = "dark_pro" | "clean_light" | "gradient" | "minimal";

export interface CarouselSlide {
  type: "cover" | "content" | "stat" | "list" | "quote" | "cta";
  headline: string;
  body: string;
  accent?: string;    // emoji or short accent text
  bullets?: string[]; // for list slides
  stat?: {           // for stat slides
    value: string;
    label: string;
    context: string;
  };
}

export interface CarouselData {
  slides: CarouselSlide[];
  authorName: string;
  authorTitle?: string;
  style: CarouselStyle;
  primaryColor: string;
  accentColor: string;
}

// ─── Color Palettes ─────────────────────────────────────────────

const PALETTES: Record<CarouselStyle, { bg: string; text: string; subtext: string; accent: string; card: string; border: string; gradientStart: string; gradientEnd: string }> = {
  dark_pro: {
    bg: "#0B1120",
    text: "#FFFFFF",
    subtext: "#94A3B8",
    accent: "#3B82F6",
    card: "#1E293B",
    border: "#334155",
    gradientStart: "#1E3A5F",
    gradientEnd: "#0B1120",
  },
  clean_light: {
    bg: "#FFFFFF",
    text: "#0F172A",
    subtext: "#64748B",
    accent: "#2563EB",
    card: "#F1F5F9",
    border: "#E2E8F0",
    gradientStart: "#EFF6FF",
    gradientEnd: "#FFFFFF",
  },
  gradient: {
    bg: "#1E1B4B",
    text: "#FFFFFF",
    subtext: "#C7D2FE",
    accent: "#818CF8",
    card: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.15)",
    gradientStart: "#4F46E5",
    gradientEnd: "#1E1B4B",
  },
  minimal: {
    bg: "#FAFAFA",
    text: "#18181B",
    subtext: "#71717A",
    accent: "#18181B",
    card: "#FFFFFF",
    border: "#E4E4E7",
    gradientStart: "#FAFAFA",
    gradientEnd: "#F4F4F5",
  },
};

// ─── SVG Slide Generator ────────────────────────────────────────

const SLIDE_W = 1080;
const SLIDE_H = 1350;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += " " + word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
}

function generateCoverSVG(slide: CarouselSlide, data: CarouselData): string {
  const p = PALETTES[data.style];
  const headlineLines = wrapText(slide.headline, 28);
  const bodyLines = wrapText(slide.body, 45);

  return `<svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${p.gradientStart}" />
      <stop offset="100%" style="stop-color:${p.gradientEnd}" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bgGrad)" />
  
  <!-- Decorative elements -->
  <circle cx="900" cy="150" r="200" fill="${data.primaryColor}" opacity="0.08" />
  <circle cx="150" cy="1100" r="150" fill="${data.accentColor}" opacity="0.06" />
  <rect x="0" y="0" width="8" height="${SLIDE_H}" fill="url(#accentBar)" />
  
  <!-- Top accent badge -->
  <rect x="80" y="120" width="120" height="36" rx="18" fill="${data.primaryColor}" opacity="0.15" />
  <text x="140" y="143" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="14" fill="${data.primaryColor}" text-anchor="middle" font-weight="bold">${escapeXml(slide.accent || "📌 POST")}</text>
  
  <!-- Main Headline -->
  ${headlineLines.map((line, i) => `
  <text x="80" y="${320 + i * 72}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="58" fill="${p.text}" font-weight="bold">${escapeXml(line)}</text>`).join("")}
  
  <!-- Accent line under headline -->
  <rect x="80" y="${320 + headlineLines.length * 72 + 20}" width="120" height="5" rx="2.5" fill="url(#accentBar)" />
  
  <!-- Body text -->
  ${bodyLines.map((line, i) => `
  <text x="80" y="${320 + headlineLines.length * 72 + 80 + i * 36}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="24" fill="${p.subtext}">${escapeXml(line)}</text>`).join("")}
  
  <!-- Swipe indicator -->
  <text x="${SLIDE_W / 2}" y="${SLIDE_H - 140}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="18" fill="${p.subtext}" text-anchor="middle" opacity="0.6">Glissez pour découvrir  →</text>
  
  <!-- Author bar -->
  <rect x="0" y="${SLIDE_H - 80}" width="${SLIDE_W}" height="80" fill="${p.card}" />
  <circle cx="60" cy="${SLIDE_H - 40}" r="20" fill="${data.primaryColor}" opacity="0.2" />
  <text x="62" y="${SLIDE_H - 34}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${data.primaryColor}" text-anchor="middle" font-weight="bold">${escapeXml(data.authorName.charAt(0))}</text>
  <text x="95" y="${SLIDE_H - 44}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.text}" font-weight="bold">${escapeXml(data.authorName)}</text>
  <text x="95" y="${SLIDE_H - 24}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="13" fill="${p.subtext}">${escapeXml(data.authorTitle || "LinkedIn Creator")}</text>
</svg>`;
}

function generateContentSVG(slide: CarouselSlide, data: CarouselData, slideNum: number, totalSlides: number): string {
  const p = PALETTES[data.style];
  const headlineLines = wrapText(slide.headline, 30);
  const bodyLines = wrapText(slide.body, 50);

  return `<svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${p.gradientStart}" />
      <stop offset="100%" style="stop-color:${p.gradientEnd}" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bgGrad)" />
  
  <!-- Top accent line -->
  <rect x="0" y="0" width="8" height="${SLIDE_H}" fill="url(#accentBar)" />
  
  <!-- Slide number -->
  <text x="${SLIDE_W - 80}" y="80" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="end" opacity="0.5">${slideNum}/${totalSlides}</text>
  
  <!-- Headline -->
  ${headlineLines.map((line, i) => `
  <text x="80" y="${180 + i * 64}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="48" fill="${p.text}" font-weight="bold">${escapeXml(line)}</text>`).join("")}
  
  <!-- Accent line -->
  <rect x="80" y="${180 + headlineLines.length * 64 + 20}" width="80" height="4" rx="2" fill="url(#accentBar)" />
  
  <!-- Body -->
  ${bodyLines.map((line, i) => `
  <text x="80" y="${180 + headlineLines.length * 64 + 80 + i * 36}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="22" fill="${p.subtext}">${escapeXml(line)}</text>`).join("")}
  
  <!-- Swipe indicator -->
  <text x="${SLIDE_W / 2}" y="${SLIDE_H - 60}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="middle" opacity="0.4">${slideNum < totalSlides ? "→ Suivant" : "← Retour"}</text>
</svg>`;
}

function generateListSVG(slide: CarouselSlide, data: CarouselData, slideNum: number, totalSlides: number): string {
  const p = PALETTES[data.style];
  const bullets = slide.bullets || [];
  const headlineLines = wrapText(slide.headline, 30);

  const bulletStartY = 280 + headlineLines.length * 60;

  return `<svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${p.gradientStart}" />
      <stop offset="100%" style="stop-color:${p.gradientEnd}" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="8" height="${SLIDE_H}" fill="url(#accentBar)" />
  
  <!-- Slide number -->
  <text x="${SLIDE_W - 80}" y="80" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="end" opacity="0.5">${slideNum}/${totalSlides}</text>
  
  <!-- Headline -->
  ${headlineLines.map((line, i) => `
  <text x="80" y="${180 + i * 60}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="44" fill="${p.text}" font-weight="bold">${escapeXml(line)}</text>`).join("")}
  
  <rect x="80" y="${180 + headlineLines.length * 60 + 15}" width="80" height="4" rx="2" fill="url(#accentBar)" />
  
  <!-- Bullets with numbered circles -->
  ${bullets.map((bullet, i) => {
    const bulletLines = wrapText(bullet, 42);
    const yBase = bulletStartY + 30 + i * 140;
    return `
  <!-- Bullet ${i + 1} -->
  <circle cx="110" cy="${yBase}" r="24" fill="${data.primaryColor}" opacity="0.15" />
  <text x="110" y="${yBase + 8}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="20" fill="${data.primaryColor}" text-anchor="middle" font-weight="bold">${i + 1}</text>
  ${bulletLines.map((bl, j) => `
  <text x="155" y="${yBase - 8 + j * 32}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="22" fill="${p.subtext}">${escapeXml(bl)}</text>`).join("")}`;
  }).join("")}
  
  <!-- Swipe indicator -->
  <text x="${SLIDE_W / 2}" y="${SLIDE_H - 60}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="middle" opacity="0.4">${slideNum < totalSlides ? "→ Suivant" : "← Retour"}</text>
</svg>`;
}

function generateStatSVG(slide: CarouselSlide, data: CarouselData, slideNum: number, totalSlides: number): string {
  const p = PALETTES[data.style];
  const stat = slide.stat || { value: "0", label: "Stat", context: "" };
  const headlineLines = wrapText(slide.headline, 30);

  return `<svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${p.gradientStart}" />
      <stop offset="100%" style="stop-color:${p.gradientEnd}" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
    <linearGradient id="statGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="8" height="${SLIDE_H}" fill="url(#accentBar)" />
  
  <!-- Decorative circles -->
  <circle cx="${SLIDE_W / 2}" cy="600" r="280" fill="${data.primaryColor}" opacity="0.04" />
  <circle cx="${SLIDE_W / 2}" cy="600" r="200" fill="${data.primaryColor}" opacity="0.06" />
  
  <!-- Slide number -->
  <text x="${SLIDE_W - 80}" y="80" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="end" opacity="0.5">${slideNum}/${totalSlides}</text>
  
  <!-- Headline -->
  ${headlineLines.map((line, i) => `
  <text x="80" y="${180 + i * 60}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="40" fill="${p.text}" font-weight="bold">${escapeXml(line)}</text>`).join("")}
  
  <!-- Big Stat Number -->
  <text x="${SLIDE_W / 2}" y="620" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="140" fill="url(#statGlow)" text-anchor="middle" font-weight="bold">${escapeXml(stat.value)}</text>
  
  <!-- Stat Label -->
  <text x="${SLIDE_W / 2}" y="700" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="28" fill="${p.text}" text-anchor="middle" font-weight="bold">${escapeXml(stat.label)}</text>
  
  <!-- Stat Context -->
  <text x="${SLIDE_W / 2}" y="750" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="20" fill="${p.subtext}" text-anchor="middle">${escapeXml(stat.context)}</text>
  
  <!-- Accent line -->
  <rect x="${SLIDE_W / 2 - 40}" y="780" width="80" height="4" rx="2" fill="url(#accentBar)" />
  
  <!-- Swipe indicator -->
  <text x="${SLIDE_W / 2}" y="${SLIDE_H - 60}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="middle" opacity="0.4">${slideNum < totalSlides ? "→ Suivant" : "← Retour"}</text>
</svg>`;
}

function generateQuoteSVG(slide: CarouselSlide, data: CarouselData, slideNum: number, totalSlides: number): string {
  const p = PALETTES[data.style];
  const quoteLines = wrapText(slide.headline, 32);

  return `<svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${p.gradientStart}" />
      <stop offset="100%" style="stop-color:${p.gradientEnd}" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="8" height="${SLIDE_H}" fill="url(#accentBar)" />
  
  <!-- Big quotation mark -->
  <text x="80" y="300" font-family="Liberation Serif, DejaVu Serif, serif" font-size="200" fill="${data.primaryColor}" opacity="0.2">"</text>
  
  <!-- Quote text -->
  ${quoteLines.map((line, i) => `
  <text x="120" y="${380 + i * 68}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="44" fill="${p.text}" font-weight="bold" font-style="italic">${escapeXml(line)}</text>`).join("")}
  
  <!-- Attribution -->
  <text x="120" y="${380 + quoteLines.length * 68 + 40}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="20" fill="${data.primaryColor}">— ${escapeXml(data.authorName)}</text>
  
  <!-- Swipe indicator -->
  <text x="${SLIDE_W / 2}" y="${SLIDE_H - 60}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="middle" opacity="0.4">${slideNum < totalSlides ? "→ Suivant" : "← Retour"}</text>
</svg>`;
}

function generateCTASVG(slide: CarouselSlide, data: CarouselData, slideNum: number, totalSlides: number): string {
  const p = PALETTES[data.style];
  const headlineLines = wrapText(slide.headline, 28);
  const bodyLines = wrapText(slide.body, 45);

  return `<svg width="${SLIDE_W}" height="${SLIDE_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${p.gradientStart}" />
      <stop offset="100%" style="stop-color:${p.gradientEnd}" />
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
    <linearGradient id="ctaBtn" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${data.primaryColor}" />
      <stop offset="100%" style="stop-color:${data.accentColor}" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${SLIDE_W}" height="${SLIDE_H}" fill="url(#bgGrad)" />
  <rect x="0" y="0" width="8" height="${SLIDE_H}" fill="url(#accentBar)" />
  
  <!-- Decorative -->
  <circle cx="${SLIDE_W / 2}" cy="400" r="300" fill="${data.primaryColor}" opacity="0.04" />
  
  <!-- Slide number -->
  <text x="${SLIDE_W - 80}" y="80" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${p.subtext}" text-anchor="end" opacity="0.5">${slideNum}/${totalSlides}</text>
  
  <!-- CTA Headline -->
  ${headlineLines.map((line, i) => `
  <text x="${SLIDE_W / 2}" y="${350 + i * 68}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="52" fill="${p.text}" text-anchor="middle" font-weight="bold">${escapeXml(line)}</text>`).join("")}
  
  <!-- CTA Button -->
  <rect x="${SLIDE_W / 2 - 200}" y="${350 + headlineLines.length * 68 + 30}" width="400" height="70" rx="35" fill="url(#ctaBtn)" />
  <text x="${SLIDE_W / 2}" y="${350 + headlineLines.length * 68 + 73}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="24" fill="#FFFFFF" text-anchor="middle" font-weight="bold">${escapeXml(slide.accent || "💬 Commentez ci-dessous")}</text>
  
  <!-- Body text -->
  ${bodyLines.map((line, i) => `
  <text x="${SLIDE_W / 2}" y="${350 + headlineLines.length * 68 + 140 + i * 34}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="20" fill="${p.subtext}" text-anchor="middle">${escapeXml(line)}</text>`).join("")}
  
  <!-- Author info -->
  <circle cx="${SLIDE_W / 2 - 80}" cy="${SLIDE_H - 160}" r="28" fill="${data.primaryColor}" opacity="0.2" />
  <text x="${SLIDE_W / 2 - 80}" y="${SLIDE_H - 152}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="20" fill="${data.primaryColor}" text-anchor="middle" font-weight="bold">${escapeXml(data.authorName.charAt(0))}</text>
  <text x="${SLIDE_W / 2 - 40}" y="${SLIDE_H - 168}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="20" fill="${p.text}" font-weight="bold">${escapeXml(data.authorName)}</text>
  <text x="${SLIDE_W / 2 - 40}" y="${SLIDE_H - 145}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="15" fill="${p.subtext}">${escapeXml(data.authorTitle || "")}</text>
  
  <!-- Follow prompt -->
  <text x="${SLIDE_W / 2}" y="${SLIDE_H - 80}" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="16" fill="${data.primaryColor}" text-anchor="middle">🔔 Suivez-moi pour plus de contenu Data &amp; IA</text>
</svg>`;
}

// ─── Main Slide Renderer ────────────────────────────────────────

function renderSlideSVG(slide: CarouselSlide, data: CarouselData, slideNum: number, totalSlides: number): string {
  switch (slide.type) {
    case "cover":  return generateCoverSVG(slide, data);
    case "stat":   return generateStatSVG(slide, data, slideNum, totalSlides);
    case "list":   return generateListSVG(slide, data, slideNum, totalSlides);
    case "quote":  return generateQuoteSVG(slide, data, slideNum, totalSlides);
    case "cta":    return generateCTASVG(slide, data, slideNum, totalSlides);
    case "content":
    default:       return generateContentSVG(slide, data, slideNum, totalSlides);
  }
}

// ─── PDF Assembly ───────────────────────────────────────────────

/**
 * Generate a professional LinkedIn carousel PDF from slide data.
 * Returns the PDF as a Buffer ready for upload.
 */
export async function generateCarouselPDF(data: CarouselData): Promise<Buffer> {
  const totalSlides = data.slides.length;
  const pngBuffers: Buffer[] = [];

  // Step 1: Render each slide SVG → PNG
  for (let i = 0; i < totalSlides; i++) {
    const svgContent = renderSlideSVG(data.slides[i], data, i + 1, totalSlides);
    const pngBuffer = await (await import("sharp")).default(Buffer.from(svgContent))
      .png({ quality: 95 })
      .toBuffer();
    pngBuffers.push(pngBuffer);
  }

  // Step 2: Create PDF and add pages
  const pdfDoc = await PDFDocument.create();
  
  for (const pngBuffer of pngBuffers) {
    const pngImage = await pdfDoc.embedPng(pngBuffer);
    const page = pdfDoc.addPage([SLIDE_W, SLIDE_H]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: SLIDE_W,
      height: SLIDE_H,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generate a single slide as PNG (for preview or standalone image).
 */
export async function generateSlidePNG(
  slide: CarouselSlide,
  data: CarouselData,
  slideNum: number = 1,
  totalSlides: number = 1
): Promise<Buffer> {
  const svgContent = renderSlideSVG(slide, data, slideNum, totalSlides);
  return (await import("sharp")).default(Buffer.from(svgContent))
    .png({ quality: 95 })
    .toBuffer();
}
