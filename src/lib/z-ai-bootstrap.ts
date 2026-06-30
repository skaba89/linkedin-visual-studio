/**
 * Z.AI SDK bootstrap — env-var aware configuration.
 *
 * Problem:
 *   `z-ai-web-dev-sdk`'s default `ZAI.create()` reads a `.z-ai-config` JSON
 *   file from disk (cwd → home → /etc). On hosting platforms like Render,
 *   this file does not exist, so `ZAI.create()` throws:
 *     "Configuration file not found or invalid. Please create .z-ai-config
 *      in your project, home directory, or /etc."
 *
 * Solution:
 *   This module lets operators configure Z.AI via environment variables,
 *   which are the idiomatic way to pass secrets on Render / Heroku / Fly.io.
 *
 *   Required env vars:
 *     ZAI_BASE_URL   — e.g. https://api.z.ai/v1
 *     ZAI_API_KEY    — the API key
 *   Optional:
 *     ZAI_TOKEN      — bearer token (sent as X-Token)
 *     ZAI_USER_ID    — user identifier (sent as X-User-Id)
 *     ZAI_CHAT_ID    — chat identifier (sent as X-Chat-Id)
 *
 *   If ZAI_BASE_URL + ZAI_API_KEY are set, we instantiate ZAI directly with
 *   `new ZAI(config)`, bypassing the file lookup entirely.
 *
 *   Otherwise, we fall back to `ZAI.create()` which reads `.z-ai-config`.
 *   This preserves local-dev behavior (where /etc/.z-ai-config exists).
 *
 * Error handling:
 *   If neither env vars nor config file are available, `getZai()` throws a
 *   typed error with an actionable message. Callers should catch and return
 *   HTTP 503 with guidance to configure the SDK.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("z-ai-bootstrap");

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

interface ZaiInstance {
  chat: {
    completions: {
      create: (body: unknown) => Promise<unknown>;
      createVision: (body: unknown) => Promise<unknown>;
    };
  };
  audio: Record<string, unknown>;
  images: {
    generations: {
      create: (body: unknown) => Promise<unknown>;
      edit: (body: unknown) => Promise<unknown>;
    };
  };
  video: Record<string, unknown>;
  functions: {
    invoke: (name: string, args: unknown) => Promise<unknown>;
  };
}

type ZaiConstructor = new (config: ZaiConfig) => ZaiInstance;
type ZaiModule = { default: ZaiConstructor & { create: () => Promise<ZaiInstance> } };

let cachedInstance: ZaiInstance | null = null;
let cachedError: Error | null = null;

function configFromEnv(): ZaiConfig | null {
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;

  if (!baseUrl || !apiKey) return null;

  return {
    baseUrl,
    apiKey,
    chatId: process.env.ZAI_CHAT_ID,
    userId: process.env.ZAI_USER_ID,
    token: process.env.ZAI_TOKEN,
  };
}

/**
 * Return a cached ZAI instance, instantiating it on first call.
 *
 * Throws if neither env vars nor config file are available.
 */
export async function getZai(): Promise<ZaiInstance> {
  if (cachedInstance) return cachedInstance;
  if (cachedError) throw cachedError;

  const ZAIModule = (await import("z-ai-web-dev-sdk")) as unknown as ZaiModule;
  const ZAI = ZAIModule.default;

  // Path 1: env vars → bypass file lookup.
  const envConfig = configFromEnv();
  if (envConfig) {
    try {
      log.info("Initializing Z.AI SDK from environment variables");
      cachedInstance = new ZAI(envConfig);
      return cachedInstance;
    } catch (err) {
      cachedError = err instanceof Error ? err : new Error(String(err));
      log.error("Z.AI SDK init from env vars failed", {
        error: cachedError.message,
      });
      throw cachedError;
    }
  }

  // Path 2: fall back to file-based config (used in dev containers).
  try {
    log.info("ZAI_* env vars not set — falling back to .z-ai-config file");
    cachedInstance = await ZAI.create();
    return cachedInstance;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Unknown Z.AI initialization error";
    cachedError = new Error(
      "Z.AI SDK is not configured. Set ZAI_BASE_URL and ZAI_API_KEY environment " +
        "variables, or create a .z-ai-config file. Original error: " +
        msg
    );
    log.error("Z.AI SDK initialization failed", { error: msg });
    throw cachedError;
  }
}

/**
 * Reset cached instance/error — for tests only.
 */
export function _resetForTests(): void {
  cachedInstance = null;
  cachedError = null;
}
