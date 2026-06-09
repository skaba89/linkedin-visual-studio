import { NextRequest, NextResponse } from "next/server";
import { getProviderBaseUrl, isOpenAICompatible } from "@/lib/providers";

/**
 * POST /api/ai/chat
 * 
 * Universal AI chat completion endpoint that routes to the correct provider.
 * Uses OpenAI-compatible API format for most providers.
 * Supports streaming and non-streaming responses.
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

    // Get API key from request header (client sends it from localStorage)
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key. Please configure your API key in Settings." },
        { status: 401 }
      );
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
