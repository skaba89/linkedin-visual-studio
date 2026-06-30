import { NextRequest, NextResponse } from "next/server";
import { getZai } from "@/lib/z-ai-bootstrap";

/**
 * POST /api/ai/web-search
 *
 * Server-side web search using z-ai-web-dev-sdk.
 * This must remain on the backend only — the SDK must NOT be used client-side.
 *
 * Body: {
 *   query: string;
 *   num?: number;  // number of results (default 10)
 * }
 *
 * Configuration:
 *   Z.AI SDK is configured either via ZAI_BASE_URL + ZAI_API_KEY env vars
 *   (recommended for Render/Heroku) or via a .z-ai-config file (dev only).
 *   If neither is set, returns 503 with an actionable error message.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, num = 10 } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Missing required field: query" },
        { status: 400 }
      );
    }

    const zai = await getZai();
    const searchResults = (await zai.functions.invoke("web_search", {
      query,
      num,
    })) as unknown;

    return NextResponse.json({ results: searchResults });
  } catch (error: unknown) {
    console.error("[/api/ai/web-search] Error:", error);

    const message =
      error instanceof Error ? error.message : "Web search failed";

    // If the Z.AI SDK is not configured, return 503 with actionable guidance
    // (instead of a generic 500 that looks like a server bug).
    if (message.includes("Z.AI SDK is not configured")) {
      return NextResponse.json(
        {
          error:
            "Service IA non configuré. Ajoutez ZAI_BASE_URL et ZAI_API_KEY dans les variables d'environnement Render, ou configurez une clé API LLM dans les Paramètres.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
