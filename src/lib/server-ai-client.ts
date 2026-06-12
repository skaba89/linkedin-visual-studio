/**
 * Server-side AI helper for HERMÈS
 * 
 * This module uses z-ai-web-dev-sdk directly for server-side AI calls,
 * avoiding the ERR_INVALID_URL issue with fetch("/api/ai/chat") in server context.
 * 
 * IMPORTANT: This module is server-side only. Never import it from client components.
 */

export interface ServerChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ServerChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Server-side AI completion using z-ai-web-dev-sdk directly.
 * This avoids the ERR_INVALID_URL problem with fetch("/api/ai/chat") in API routes.
 */
export async function serverChatCompletion(
  messages: ServerChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<ServerChatResponse> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const completion = await zai.chat.completions.create({
    messages,
    model: options?.model && options.model !== "default" ? options.model : undefined,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 1024,
  });

  const content = completion.choices?.[0]?.message?.content || "";
  
  return {
    content,
    model: completion.model || options?.model || "zai",
    usage: completion.usage || undefined,
  };
}
