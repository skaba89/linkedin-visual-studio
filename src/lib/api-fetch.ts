/**
 * HERMÈS — apiFetch: fetch() wrapper with automatic toast feedback
 *
 * Drop-in replacement for fetch() that:
 *   1. Throws on non-2xx responses (so try/catch works naturally)
 *   2. Auto-fires toast.success / toast.error based on the response
 *   3. Optionally shows a loading toast during the request
 *
 * Usage (most common):
 *   const data = await apiFetch<MyData>("/api/data/contacts", {
 *     method: "POST",
 *     body: { prenom, nom, email },
 *     // automatic toasts:
 *     successMessage: "Contact créé",
 *     errorMessage: "Échec de la création",
 *     loadingMessage: "Création en cours…",
 *   });
 *
 * Or silent (no toasts) for background fetches:
 *   const data = await apiFetch<MyData>("/api/data/contacts", { silent: true });
 *
 * Or only error toast (no success toast — for read operations that fail noisily):
 *   const data = await apiFetch<MyData>("/api/data/contacts", {
 *     errorMessage: "Échec du chargement des contacts",
 *   });
 */
import { toast } from "@/lib/toast";

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serializable body (will be JSON.stringify'd automatically). */
  body?: unknown;
  /** Optional URL query params. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Custom headers (merged with defaults). */
  headers?: Record<string, string>;
  /** Hide all toasts (for background/periodic fetches). Default: false. */
  silent?: boolean;
  /** Toast message on 2xx. Skip to suppress success toast. */
  successMessage?: string;
  /** Toast message on non-2xx. Defaults to a generic French message. */
  errorMessage?: string;
  /** Toast message during the request. Skip to suppress loading toast. */
  loadingMessage?: string;
  /** Credentials mode. Default: "include" (sends NextAuth cookies). */
  credentials?: RequestCredentials;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    message: string,
    public body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    headers = {},
    silent = false,
    successMessage,
    errorMessage,
    loadingMessage,
    credentials = "include",
  } = opts;

  // Build final URL with query string
  let finalUrl = url;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) finalUrl += (url.includes("?") ? "&" : "?") + qs;
  }

  // Build fetch options
  const fetchOpts: RequestInit = {
    method,
    credentials,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  // Show loading toast if requested
  const toastId = loadingMessage && !silent ? toast.loading(loadingMessage) : undefined;

  try {
    const response = await fetch(finalUrl, fetchOpts);

    // Parse JSON (most HERMÈS APIs return JSON)
    let data: unknown = null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => null);
    }

    if (!response.ok) {
      // Extract error message from body
      const errBody = data as { error?: string; message?: string; code?: string } | null;
      const serverMessage = errBody?.error ?? errBody?.message ?? `Erreur ${response.status}`;
      const serverCode = errBody?.code;

      const apiErr = new ApiError(
        response.status,
        serverCode,
        serverMessage,
        data,
      );

      if (!silent) {
        const toastMsg = errorMessage ?? "Une erreur est survenue";
        toast.error(toastMsg, {
          id: toastId,
          description: serverMessage,
        });
      }

      throw apiErr;
    }

    // Success
    if (!silent && successMessage) {
      toast.success(successMessage, { id: toastId });
    } else if (toastId) {
      // Dismiss the loading toast without showing a success message
      toast.custom.dismiss(toastId);
    }

    return data as T;
  } catch (err) {
    // If it's already an ApiError we already handled the toast
    if (err instanceof ApiError) throw err;

    // Network error, CORS, etc.
    const message = err instanceof Error ? err.message : String(err);
    if (!silent) {
      toast.error(errorMessage ?? "Erreur réseau", {
        id: toastId,
        description: message,
      });
    }
    throw err;
  }
}

/**
 * Convenience helpers for the common HTTP verbs.
 */
export const api = {
  get: <T = unknown>(url: string, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...opts, method: "GET" }),
  post: <T = unknown>(url: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...opts, method: "POST", body }),
  put: <T = unknown>(url: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...opts, method: "PUT", body }),
  patch: <T = unknown>(url: string, body?: unknown, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...opts, method: "PATCH", body }),
  delete: <T = unknown>(url: string, opts?: Omit<ApiFetchOptions, "method" | "body">) =>
    apiFetch<T>(url, { ...opts, method: "DELETE" }),
};
