/**
 * Client-side AI helper for HERMÈS
 * 
 * Provides a simple interface for components to make AI calls
 * through the /api/ai/chat endpoint using the configured provider.
 */

import { useAppStore } from "@/store/appStore";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** Override the provider from config */
  providerId?: string;
  /** Override the model from config */
  model?: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Preferred fallback order when the configured provider has no API key.
 */
const PROVIDER_FALLBACK_ORDER = [
  "groq",
  "openrouter",
  "google",
  "deepseek",
  "mistral",
  "together",
  "sambanova",
  "cerebras",
  "openai",
  "anthropic",
];

/**
 * Send a chat completion request using the currently configured provider.
 * API key is read from the Zustand store and sent as a header.
 * If the configured provider has no API key, automatically falls back
 * to another provider that has one.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<ChatResponse> {
  // Read config from store
  const state = useAppStore.getState();
  let providerId = options?.providerId || state.hermesConfig.provider;
  let model = options?.model || state.hermesConfig.model;
  let apiKey = state.hermesConfig.providerApiKeys[providerId];

  // If no API key for the configured provider, try fallback providers
  if (!apiKey) {
    const fallbackProvider = PROVIDER_FALLBACK_ORDER.find(
      (p) => state.hermesConfig.providerApiKeys[p]
    );

    if (fallbackProvider) {
      const fallbackKey = state.hermesConfig.providerApiKeys[fallbackProvider];
      console.warn(
        `[HERMÈS] Clé API non configurée pour "${providerId}". ` +
        `Fallback automatique vers "${fallbackProvider}".`
      );
      providerId = fallbackProvider;
      apiKey = fallbackKey;
      // Don't override the model if it was explicitly provided via options
      if (!options?.model) {
        model = state.hermesConfig.model;
      }
    } else {
      throw new Error(
        `Clé API non configurée pour le provider "${providerId}". ` +
        `Aucun provider alternatif disponible. Allez dans Paramètres pour configurer une clé API.`
      );
    }
  }

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      providerId,
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
      stream: options?.stream ?? false,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `Erreur API (${response.status})`);
  }

  const data = await response.json();

  // Normalize response format across providers
  // OpenAI-compatible format
  if (data.choices?.[0]?.message?.content) {
    return {
      content: data.choices[0].message.content,
      model: data.model || model,
      usage: data.usage,
    };
  }

  // Anthropic format
  if (data.content?.[0]?.text) {
    return {
      content: data.content[0].text,
      model: data.model || model,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
    };
  }

  // Fallback
  return {
    content: JSON.stringify(data),
    model: model,
  };
}

/**
 * Quick helper: generate a LinkedIn post using the configured AI provider.
 */
export async function generateLinkedInPost(
  topic: string,
  icp: string = "CEO, CMO, fondateurs de startups B2B",
  tone: string = "direct, factuel, sans jargon",
  expertTopic?: string
): Promise<string> {
  const topicInstruction = expertTopic
    ? `Sujet imposé : "${expertTopic}". Tu dois absolument traiter ce sujet avec un angle d'expert data.`
    : "";
  
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en contenu LinkedIn spécialisé dans l'IA et l'acquisition B2B.
Ton audience cible : ${icp}
Ton : ${tone}
${topicInstruction}
Tu rédiges des posts LinkedIn percutants avec cette structure :
- Hook (ligne 1 — doit forcer le "voir plus")
- Corps (3 à 4 paragraphes courts, max 3 lignes chacun)
- CTA (question ouverte ou instruction "commentez X")
Longueur : 150 à 220 mots.`,
    },
    {
      role: "user",
      content: expertTopic
        ? `Rédige un post LinkedIn sur le sujet : ${expertTopic}`
        : `Rédige un post LinkedIn sur le sujet suivant : ${topic}`,
    },
  ];

  const response = await chatCompletion(messages, {
    temperature: 0.8,
    maxTokens: 500,
  });

  return response.content;
}

/**
 * Quick helper: qualify a lead using the configured AI provider.
 */
export async function qualifyLead(
  leadInfo: { name: string; title: string; company: string; sector: string; action: string },
  icpTitles: string[],
  icpSectors: string[],
  icpSizes: string[]
): Promise<{ score: number; reasoning: string }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `Tu es un expert en qualification B2B. Tu évalues les prospects selon un scoring ICP.
Critères :
- Titre correspond à ICP : +30 pts (${icpTitles.join(", ")})
- Secteur correspond : +20 pts (${icpSectors.join(", ")})
- Taille entreprise correspondante : +20 pts (${icpSizes.join(", ")})
- A commenté (vs simplement liké) : +15 pts
- Seuil de qualification : score >= 60

Réponds UNIQUEMENT en JSON : { "score": number, "reasoning": "explication courte" }`,
    },
    {
      role: "user",
      content: `Qualifie ce prospect :
- Nom: ${leadInfo.name}
- Poste: ${leadInfo.title}
- Entreprise: ${leadInfo.company}
- Secteur: ${leadInfo.sector}
- Action: ${leadInfo.action}`,
    },
  ];

  const response = await chatCompletion(messages, {
    temperature: 0.3,
    maxTokens: 200,
  });

  try {
    // Try to parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback
  }

  return { score: 0, reasoning: "Erreur de parsing IA" };
}
