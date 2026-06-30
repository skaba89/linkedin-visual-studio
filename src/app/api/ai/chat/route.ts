import { NextRequest, NextResponse } from "next/server";
import { getProviderBaseUrl, isOpenAICompatible } from "@/lib/providers";
import { serverChatCompletion } from "@/lib/server-ai-client";
import { createZaiFromApiKey } from "@/lib/z-ai-bootstrap";

/**
 * POST /api/ai/chat
 *
 * Universal AI chat completion endpoint that routes to the correct provider.
 * Uses OpenAI-compatible API format for most providers.
 * Supports streaming and non-streaming responses.
 *
 * Special providers:
 *   - providerId === "zai": routes through z-ai-web-dev-sdk.
 *     If `x-api-key` header is set, instantiates a per-request ZAI with that
 *     key. Otherwise falls back to server-configured ZAI (env vars or
 *     .z-ai-config file).
 *
 * Body: {
 *   providerId: string;
 *   model: string;
 *   messages: Array<{ role: string; content: string }>;
 *   temperature?: number;
 *   max_tokens?: number;
 *   stream?: boolean;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { providerId, model, messages, temperature = 0.7, max_tokens = 1024, stream = false } = body;

    if (!providerId || !model || !messages) {
      return NextResponse.json(
        { error: "Missing required fields: providerId, model, messages" },
        { status: 400 }
      );
    }

    // ─── Special case: Z.AI via z-ai-web-dev-sdk ────────────────────────────
    if (providerId === "zai") {
      return handleZai(req, model, messages, temperature, max_tokens);
    }

    // Get API key from request header (client sends it from localStorage)
    const apiKey = req.headers.get("x-api-key");

    // If no API key is configured, fall back to z-ai-web-dev-sdk (built-in AI)
    if (!apiKey) {
      try {
        console.log("[/api/ai/chat] No user API key — falling back to z-ai-web-dev-sdk");
        const result = await serverChatCompletion(
          messages.map((m: { role: string; content: string }) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
          {
            model: model !== "default" ? model : undefined,
            temperature,
            maxTokens: max_tokens,
          }
        );
        return NextResponse.json({
          choices: [{ message: { role: "assistant", content: result.content } }],
          model: result.model,
          usage: result.usage,
        });
      } catch (sdkError: unknown) {
        console.error("[/api/ai/chat] z-ai-web-dev-sdk fallback error:", sdkError);
        const msg = sdkError instanceof Error ? sdkError.message : "AI service unavailable";
        return NextResponse.json(
          { error: `IA non disponible : ${msg}. Configurez une clé API dans les Paramètres.` },
          { status: 503 }
        );
      }
    }

    // Route to the correct provider
    if (providerId === "anthropic") {
      return handleAnthropic(apiKey, model, messages, temperature, max_tokens, stream);
    }

    // All other providers use OpenAI-compatible format
    return handleOpenAICompatible(providerId, apiKey, model, messages, temperature, max_tokens, stream);
  } catch (error: unknown) {
    console.error("[/api/ai/chat] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Handle Z.AI chat completion via z-ai-web-dev-sdk.
 *
 * Two paths:
 *  1. User provided an API key in the `x-api-key` header → instantiate per-request ZAI
 *  2. No user key → fall back to server-configured ZAI (env vars or .z-ai-config file)
 */
async function handleZai(
  req: NextRequest,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  max_tokens: number,
) {
  const userApiKey = req.headers.get("x-api-key");

  try {
    let zai;
    let usedModel: string;

    if (userApiKey && userApiKey.trim().length >= 8) {
      console.log("[/api/ai/chat] Z.AI — using user-provided API key");
      zai = await createZaiFromApiKey(userApiKey);
      usedModel = model !== "default" ? model : "glm-4.6";
    } else {
      console.log("[/api/ai/chat] Z.AI — using server-configured SDK");
      // Lazy-import to avoid circular deps with serverChatCompletion
      const { getZai } = await import("@/lib/z-ai-bootstrap");
      zai = await getZai();
      usedModel = model !== "default" ? model : "glm-4.6";
    }

    const completion = (await zai.chat.completions.create({
      messages: messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      model: usedModel,
      temperature,
      max_tokens,
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const content = completion.choices?.[0]?.message?.content || "";
    return NextResponse.json({
      choices: [{ message: { role: "assistant", content } }],
      model: completion.model || usedModel,
      usage: completion.usage,
    });
  } catch (error: unknown) {
    console.error("[/api/ai/chat] Z.AI error:", error);
    const msg = error instanceof Error ? error.message : "Z.AI service unavailable";
    const status = msg.includes("not configured") || msg.includes("invalide") ? 503 : 500;
    return NextResponse.json(
      { error: `Z.AI : ${msg}` },
      { status }
    );
  }
}

/**
 * Handle OpenAI-compatible providers (Groq, OpenRouter, Together, DeepSeek, Mistral, etc.)
 */
async function handleOpenAICompatible(
  providerId: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  max_tokens: number,
  stream: boolean
) {
  const baseUrl = getProviderBaseUrl(providerId);
  if (!baseUrl) {
    return NextResponse.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 400 }
    );
  }

  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter requires additional headers
  if (providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://hermes-ai.app";
    headers["X-Title"] = "HERMÈS AI Gateway";
  }

  const payload = {
    model,
    messages,
    temperature,
    max_tokens,
    stream,
  };

  if (stream) {
    // Forward the stream from the provider
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Chat] Provider ${providerId} error:`, response.status, errorText);
      return NextResponse.json(
        { error: `Provider error (${response.status}): ${errorText.slice(0, 200)}` },
        { status: response.status }
      );
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming request
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI Chat] Provider ${providerId} error:`, response.status, errorText);
    return NextResponse.json(
      { error: `Provider error (${response.status}): ${errorText.slice(0, 200)}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}

/**
 * Handle Anthropic (non-OpenAI-compatible format)
 */
async function handleAnthropic(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  max_tokens: number,
  stream: boolean
) {
  const url = "https://api.anthropic.com/v1/messages";

  // Extract system message if present
  let systemPrompt: string | undefined;
  const filteredMessages = messages.filter((m) => {
    if (m.role === "system") {
      systemPrompt = m.content;
      return false;
    }
    return true;
  });

  const payload: Record<string, unknown> = {
    model,
    messages: filteredMessages,
    temperature,
    max_tokens,
    stream,
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };

  if (stream) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Anthropic error (${response.status}): ${errorText.slice(0, 200)}` },
        { status: response.status }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Anthropic error (${response.status}): ${errorText.slice(0, 200)}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
