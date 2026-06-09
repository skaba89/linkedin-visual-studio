/**
 * AI Provider Registry for HERMÈS
 * 
 * Centralizes all supported LLM providers, their models, 
 * API key formats, and metadata for the settings UI.
 */

export interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  free: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  icon: string;       // lucide icon name
  color: string;      // brand hex color
  models: AIModel[];
  apiKeyPlaceholder: string;
  apiKeyPrefix: string;
  docsUrl: string;
  free: boolean;      // has a free tier
  baseUrl?: string;   // custom API base URL
}

export const AI_PROVIDERS: AIProvider[] = [
  // ─── FREE PROVIDERS ────────────────────────────────
  {
    id: "groq",
    name: "Groq",
    icon: "Zap",
    color: "#F55036",
    free: true,
    apiKeyPlaceholder: "gsk_...",
    apiKeyPrefix: "gsk_",
    docsUrl: "https://console.groq.com/keys",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B",
        description: "Modèle polyvalent le plus rapide, idéal pour la génération de contenu",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B",
        description: "Ultra-rapide pour les tâches simples et la qualification",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "llama-3.2-1b-preview",
        name: "Llama 3.2 1B",
        description: "Le plus rapide, parfait pour les réponses courtes",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        description: "Modèle MoE pour un bon équilibre qualité/vitesse",
        contextWindow: 32768,
        free: true,
      },
      {
        id: "gemma2-9b-it",
        name: "Gemma 2 9B",
        description: "Modèle Google compact et performant",
        contextWindow: 8192,
        free: true,
      },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    icon: "Sparkles",
    color: "#4285F4",
    free: true,
    apiKeyPlaceholder: "AIza...",
    apiKeyPrefix: "AIza",
    docsUrl: "https://aistudio.google.com/apikey",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Rapide et intelligent, le meilleur rapport qualité/prix",
        contextWindow: 1048576,
        free: true,
      },
      {
        id: "gemini-2.0-flash-lite",
        name: "Gemini 2.0 Flash Lite",
        description: "Le plus rapide de la gamme Gemini, idéal pour les tâches simples",
        contextWindow: 1048576,
        free: true,
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        description: "Fenêtre de contexte massive, rapide et économique",
        contextWindow: 1048576,
        free: true,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Le plus puissant de la gamme, pour les tâches complexes",
        contextWindow: 2097152,
        free: true,
      },
    ],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    icon: "Cpu",
    color: "#7C3AED",
    free: true,
    apiKeyPlaceholder: "csk-...",
    apiKeyPrefix: "csk-",
    docsUrl: "https://cloud.cerebras.ai/",
    baseUrl: "https://api.cerebras.ai/v1",
    models: [
      {
        id: "llama-3.3-70b",
        name: "Llama 3.3 70B",
        description: "Inférence la plus rapide au monde sur Llama 70B",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "llama-3.1-8b",
        name: "Llama 3.1 8B",
        description: "Ultra-rapide pour les tâches légères",
        contextWindow: 128000,
        free: true,
      },
    ],
  },
  {
    id: "sambanova",
    name: "SambaNova",
    icon: "Bolt",
    color: "#E5383B",
    free: true,
    apiKeyPlaceholder: "sk-...",
    apiKeyPrefix: "sk-",
    docsUrl: "https://cloud.sambanova.ai/",
    baseUrl: "https://api.sambanova.ai/v1",
    models: [
      {
        id: "Meta-Llama-3.3-70B-Instruct",
        name: "Llama 3.3 70B",
        description: "Inférence ultra-rapide sur le custom silicon SambaNova",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "Meta-Llama-3.1-8B-Instruct",
        name: "Llama 3.1 8B",
        description: "Rapide et léger pour les tâches de qualification",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "DeepSeek-R1",
        name: "DeepSeek R1",
        description: "Raisonnement avancé sur infrastructure SambaNova",
        contextWindow: 128000,
        free: true,
      },
    ],
  },

  // ─── AGGREGATORS (accès multi-modèles) ─────────────
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "Route",
    color: "#6D28D9",
    free: true,
    apiKeyPlaceholder: "sk-or-...",
    apiKeyPrefix: "sk-or-",
    docsUrl: "https://openrouter.ai/keys",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      {
        id: "meta-llama/llama-3.3-70b-instruct:free",
        name: "Llama 3.3 70B (Free)",
        description: "Le meilleur modèle gratuit sur OpenRouter",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash (Free)",
        description: "Gemini Flash gratuit via OpenRouter",
        contextWindow: 1048576,
        free: true,
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1 (Free)",
        description: "Raisonnement avancé gratuit",
        contextWindow: 163840,
        free: true,
      },
      {
        id: "deepseek/deepseek-chat:free",
        name: "DeepSeek V3 (Free)",
        description: "Chat avancé gratuit, excellent pour le contenu",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "mistralai/mistral-small-3.1-24b-instruct:free",
        name: "Mistral Small 3.1 (Free)",
        description: "Compact et rapide pour la qualification",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "qwen/qwen3-235b-a22b:free",
        name: "Qwen 3 235B (Free)",
        description: "Modèle MoE massif, excellent pour les tâches complexes",
        contextWindow: 131072,
        free: true,
      },
    ],
  },
  {
    id: "together",
    name: "Together AI",
    icon: "Users",
    color: "#14B8A6",
    free: true,
    apiKeyPlaceholder: "sk-...",
    apiKeyPrefix: "sk-",
    docsUrl: "https://api.together.xyz/settings/api-keys",
    baseUrl: "https://api.together.xyz/v1",
    models: [
      {
        id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        name: "Llama 3.3 70B Turbo",
        description: "Le plus rapide sur Together AI, idéal pour le contenu",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
        name: "Llama 3.1 8B Turbo",
        description: "Léger et ultra-rapide pour la qualification",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "deepseek-ai/DeepSeek-R1",
        name: "DeepSeek R1",
        description: "Raisonnement avancé pour la prospection",
        contextWindow: 128000,
        free: true,
      },
      {
        id: "Qwen/Qwen2.5-72B-Instruct-Turbo",
        name: "Qwen 2.5 72B Turbo",
        description: "Excellent pour la génération multilingue",
        contextWindow: 32768,
        free: true,
      },
    ],
  },

  // ─── LOW-COST PROVIDERS ────────────────────────────
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "Search",
    color: "#2563EB",
    free: false,
    apiKeyPlaceholder: "sk-...",
    apiKeyPrefix: "sk-",
    docsUrl: "https://platform.deepseek.com/api_keys",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek V3",
        description: "Excellent pour la génération de contenu, très abordable",
        contextWindow: 128000,
        free: false,
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1",
        description: "Raisonnement avancé pour les tâches complexes de prospection",
        contextWindow: 128000,
        free: false,
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    icon: "Wind",
    color: "#F97316",
    free: false,
    apiKeyPlaceholder: "sk-...",
    apiKeyPrefix: "sk-",
    docsUrl: "https://console.mistral.ai/api-keys",
    baseUrl: "https://api.mistral.ai/v1",
    models: [
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        description: "Le plus puissant de Mistral, pour les tâches complexes",
        contextWindow: 128000,
        free: false,
      },
      {
        id: "mistral-medium-latest",
        name: "Mistral Medium",
        description: "Bon équilibre qualité/prix pour le contenu",
        contextWindow: 128000,
        free: false,
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        description: "Rapide et économique pour la qualification",
        contextWindow: 128000,
        free: false,
      },
      {
        id: "codestral-latest",
        name: "Codestral",
        description: "Spécialisé pour le code et la génération technique",
        contextWindow: 256000,
        free: false,
      },
    ],
  },

  // ─── PREMIUM PROVIDERS ─────────────────────────────
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "Brain",
    color: "#D4A574",
    free: false,
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyPrefix: "sk-ant-",
    docsUrl: "https://console.anthropic.com/settings/keys",
    models: [
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        description: "Le meilleur rapport qualité/prix d'Anthropic",
        contextWindow: 200000,
        free: false,
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        description: "Rapide et abordable, idéal pour la qualification",
        contextWindow: 200000,
        free: false,
      },
      {
        id: "claude-opus-4-0",
        name: "Claude Opus 4.0",
        description: "Le plus puissant, pour les tâches de raisonnement avancé",
        contextWindow: 200000,
        free: false,
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "MessageSquare",
    color: "#10A37F",
    free: false,
    apiKeyPlaceholder: "sk-...",
    apiKeyPrefix: "sk-",
    docsUrl: "https://platform.openai.com/api-keys",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Le flagship polyvalent d'OpenAI",
        contextWindow: 128000,
        free: false,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Rapide et abordable pour les tâches simples",
        contextWindow: 128000,
        free: false,
      },
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        description: "Dernière génération, suivi d'instructions amélioré",
        contextWindow: 1047576,
        free: false,
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        description: "Rapide et intelligent, bon rapport qualité/prix",
        contextWindow: 1047576,
        free: false,
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        description: "Raisonnement avancé à coût réduit",
        contextWindow: 200000,
        free: false,
      },
    ],
  },
];

/** Get a provider by ID */
export function getProvider(providerId: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === providerId);
}

/** Get a model from a provider */
export function getModel(providerId: string, modelId: string): AIModel | undefined {
  const provider = getProvider(providerId);
  return provider?.models.find((m) => m.id === modelId);
}

/** Get all free providers */
export function getFreeProviders(): AIProvider[] {
  return AI_PROVIDERS.filter((p) => p.free);
}

/** Group providers by category */
export function getProvidersByCategory() {
  return {
    free: AI_PROVIDERS.filter((p) => p.free),
    aggregators: AI_PROVIDERS.filter((p) => ["openrouter", "together"].includes(p.id)),
    lowCost: AI_PROVIDERS.filter((p) => ["deepseek", "mistral"].includes(p.id)),
    premium: AI_PROVIDERS.filter((p) => ["anthropic", "openai"].includes(p.id)),
  };
}

/**
 * Map provider → OpenAI-compatible base URL for API routing.
 * Providers with OpenAI-compatible APIs can be called uniformly.
 */
export function getProviderBaseUrl(providerId: string): string {
  const provider = getProvider(providerId);
  if (provider?.baseUrl) return provider.baseUrl;

  switch (providerId) {
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "openai":
      return "https://api.openai.com/v1";
    case "groq":
      return "https://api.groq.com/openai/v1";
    default:
      return "";
  }
}

/**
 * Check if a provider uses an OpenAI-compatible API format.
 * Most providers do, except Anthropic which has its own format.
 */
export function isOpenAICompatible(providerId: string): boolean {
  return providerId !== "anthropic";
}
