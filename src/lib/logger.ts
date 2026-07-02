/**
 * Structured Logger for HERMÈS
 *
 * Works in both browser and Node.js:
 * - Server (dev):  colourised, human-readable output via process.stdout/stderr
 * - Server (prod): one-line JSON per entry (for log aggregation / ELK / Datadog)
 * - Browser (dev): pretty-formatted console output with prefixes
 * - Browser (prod): structured JSON via console (aggregator-friendly)
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("ai-client");
 *   log.info("Request started", { provider: "groq", model: "llama-3.3" });
 *   log.error("API call failed", { status: 429 });
 */

// ─── Types ───────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
}

interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

// ─── Environment detection ──────────────────────────────────────────

const isBrowser = typeof window !== "undefined";
const isDev =
  isBrowser
    ? // In the browser we can't read NODE_ENV at runtime, but Next.js
      // strips process.env.NODE_ENV at build time so this works:
      process.env.NODE_ENV !== "production"
    : process.env.NODE_ENV !== "production";

// ─── Colour helpers (Node.js dev only) ──────────────────────────────

const LEVEL_COLOURS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
};

const COLOUR_RESET = "\x1b[0m";
const COLOUR_DIM = "\x1b[2m";
const COLOUR_BRIGHT = "\x1b[1m";

function colourise(level: LogLevel, text: string): string {
  return `${LEVEL_COLOURS[level]}${text}${COLOUR_RESET}`;
}

// ─── Formatters ─────────────────────────────────────────────────────

function isoNow(): string {
  return new Date().toISOString();
}

/** Human-readable coloured output for Node.js dev */
function formatDevServer(entry: LogEntry): string {
  const ts = `${COLOUR_DIM}${entry.timestamp}${COLOUR_RESET}`;
  const lvl = colourise(entry.level, entry.level.toUpperCase().padEnd(5));
  const mod = `${COLOUR_BRIGHT}[${entry.module}]${COLOUR_RESET}`;
  const ctx = entry.context
    ? `\n  ${COLOUR_DIM}${JSON.stringify(entry.context, null, 2)}${COLOUR_RESET}`
    : "";
  return `${ts} ${lvl} ${mod} ${entry.message}${ctx}`;
}

/** Pretty prefix for browser dev console */
function formatDevBrowser(entry: LogEntry): string {
  const lvl = entry.level.toUpperCase().padEnd(5);
  const prefix = `[${entry.module}] ${lvl}`;
  return `${prefix} ${entry.message}`;
}

/** Single-line JSON — works everywhere, ideal for aggregators */
function formatProd(entry: LogEntry): string {
  return JSON.stringify({
    timestamp: entry.timestamp,
    level: entry.level,
    module: entry.module,
    message: entry.message,
    ...(entry.context && { context: entry.context }),
  });
}

// ─── Writers ────────────────────────────────────────────────────────

function writeServer(level: LogLevel, entry: LogEntry): void {
  const output = isDev ? formatDevServer(entry) : formatProd(entry);

  if (level === "debug" && !isDev && process.env.LOG_LEVEL !== "debug") {
    return; // skip debug in production unless explicitly enabled
  }

  switch (level) {
    case "debug":
    case "info":
      process.stdout.write(output + "\n");
      break;
    case "warn":
    case "error":
      process.stderr.write(output + "\n");
      break;
  }
}

function writeBrowser(level: LogLevel, entry: LogEntry): void {
  if (level === "debug" && !isDev) {
    return; // skip debug in production
  }

  if (isDev) {
    // Dev: pretty prefix + structured data separately
    const prefix = formatDevBrowser(entry);
    const consoleFn =
      level === "error" ? console.error
        : level === "warn" ? console.warn
          : level === "debug" ? console.debug
            : console.info;

    if (entry.context) {
      consoleFn(prefix, entry.context);
    } else {
      consoleFn(prefix);
    }
  } else {
    // Prod: JSON string via the appropriate console method
    const json = formatProd(entry);
    switch (level) {
      case "error": console.error(json); break;
      case "warn":  console.warn(json);  break;
      case "debug": console.debug(json); break;
      default:      console.info(json);  break;
    }
  }
}

// ─── Core write dispatcher ──────────────────────────────────────────

function write(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: isoNow(),
    level,
    module,
    message,
    ...(context && { context }),
  };

  if (isBrowser) {
    writeBrowser(level, entry);
  } else {
    writeServer(level, entry);
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Create a child logger pre-tagged with a module name.
 */
function createLogger(moduleName: string): Logger {
  return {
    debug: (message, context) => write("debug", moduleName, message, context),
    info:  (message, context) => write("info",  moduleName, message, context),
    warn:  (message, context) => write("warn",  moduleName, message, context),
    error: (message, context) => write("error", moduleName, message, context),
  };
}

/**
 * Default (root) logger — use when no specific module applies.
 */
const logger: Logger = createLogger("app");

export { logger, createLogger };
export type { Logger };
