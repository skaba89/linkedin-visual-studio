import { NextRequest, NextResponse } from "next/server";
import { getProvider, getProviderBaseUrl } from "@/lib/providers";
import { createZaiFromApiKey } from "@/lib/z-ai-bootstrap";

/**
 * POST /api/ai/test
 *
 * Tests connectivity to an AI provider using the user-provided API key.
 * Called by the Settings UI when the user clicks the "Test" button next to
 * a provider card.
 *
 * Body: {
 *   providerId: string;
 *   apiKey: string;
 *   modelId?: string;  // optional — defaults to the first model of the provider
 * }
 *
 * Response:
 *   200 { ok: true, model, message }
 *   400 { ok: false, error }  — missing/invalid input
 *   401 { ok: false, error }  — auth failed at the provider
 *   503 { ok: false, error }  — provider unreachable / Z.AI not configured
 *   500 { ok: false, error }  — unexpected
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, apiKey } = body as { providerId: string; apiKey: string };

    if (!providerId) {
      return NextResponse.json(
        { ok: false, error: "providerId manquant" },
        { status: 400 }
      );
    }

    const provider = getProvider(providerId);
    if (!provider) {
      return NextResponse.json(
        { ok: false, error: `Provider inconnu: ${providerId}` },
        { status: 400 }
      );
    }

    // ─── Z.AI: use the z-ai-web-dev-sdk ───────────────────────────────────
    if (providerId === "zai") {
      // If no user key, try the server-configured SDK
      if (!apiKey || apiKey.trim().length < 8) {
        try {
          const { getZai } = await import("@/lib/z-ai-bootstrap");
          const zai = await getZai();
          const completion = (await zai.chat.completions.create({
            messages: [{ role: "user", content: "ping" }],
            model: "glm-4-flash",
            max_tokens: 5,
          })) as { choices?: Array<{ message?: { content?: string } }> };
          const reply = completion.choices?.[0]?.message?.content ?? "(empty)";
          return NextResponse.json({
            ok: true,
            model: "glm-4-flash",
            message: `Z.AI (clé serveur) OK — réponse: "${reply.slice(0, 40)}"`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return NextResponse.json(
            { ok: false, error: `Z.AI (clé serveur) indisponible: ${msg}` },
            { status: 503 }
          );
        }
      }

      // User provided a key — instantiate per-request
      try {
        const zai = await createZaiFromApiKey(apiKey);
        const completion = (await zai.chat.completions.create({
          messages: [{ role: "user", content: "ping" }],
          model: "glm-4-flash",
          max_tokens: 5,
        })) as { choices?: Array<{ message?: { content?: string } }> };
        const reply = completion.choices?.[0]?.message?.content ?? "(empty)";
        return NextResponse.json({
          ok: true,
          model: "glm-4-flash",
          message: `Z.AI OK — réponse: "${reply.slice(0, 40)}"`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { ok: false, error: `Z.AI: ${msg}` },
          { status: 401 }
        );
      }
    }

    // ─── All other providers: send a minimal OpenAI/Anthropic ping ──────
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Clé API manquante" },
        { status: 400 }
      );
    }

    const modelId = body.modelId || provider.models[0]?.id;
    if (!modelId) {
      return NextResponse.json(
        { ok: false, error: "Aucun modèle disponible pour ce provider" },
        { status: 400 }
      );
    }

    // Anthropic uses a different request format
    if (providerId === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { ok: false, error: `Anthropic (${res.status}): ${text.slice(0, 120)}` },
          { status: res.status === 401 ? 401 : 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        model: modelId,
        message: "Anthropic OK",
      });
    }

    // OpenAI-compatible providers
    const baseUrl = getProviderBaseUrl(providerId);
    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, error: `Base URL non configurée pour ${providerId}` },
        { status: 500 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (providerId === "openrouter") {
      headers["HTTP-Referer"] = "https://hermes-ai.app";
      headers["X-Title"] = "HERMÈS AI Gateway";
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: `${provider.name} (${res.status}): ${text.slice(0, 120)}` },
        { status: res.status === 401 ? 401 : 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      model: modelId,
      message: `${provider.name} OK`,
    });
  } catch (error: unknown) {
    console.error("[/api/ai/test] Error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
