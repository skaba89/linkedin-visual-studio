import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

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

    const zai = await ZAI.create();
    const searchResults = await zai.functions.invoke("web_search", {
      query,
      num,
    });

    return NextResponse.json({ results: searchResults });
  } catch (error: unknown) {
    console.error("[/api/ai/web-search] Error:", error);
    const message =
      error instanceof Error ? error.message : "Web search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
