/**
 * HERMÈS — Toast helpers
 *
 * Wrapper autour de `sonner` pour appliquer nos conventions :
 *  - traductions FR
 *  - icônes cohérentes (success: CheckCircle, error: AlertCircle)
 *  - format standard : `toast.success("Action réussie", { description })`
 *
 * Usage:
 *   import { toast } from "@/lib/toast";
 *   toast.success("Post publié", { description: "Visible sur LinkedIn" });
 *   toast.error("Échec de la publication", { description: error.message });
 *   toast.promise(fetchApi(), { success, error, loading });
 */

import { toast as sonnerToast } from "sonner";

// sonner doesn't export ToastOptions directly — use its `toast` function's
// options shape via Parameters. This keeps us decoupled from sonner's
// internal type names.
export type HermesToastOptions = Parameters<typeof sonnerToast>[1] & {};

/**
 * Toast de succès — action terminée avec succès.
 */
export function success(message: string, opts?: HermesToastOptions) {
  return sonnerToast.success(message, opts);
}

/**
 * Toast d'erreur — action échouée. Toujours inclure une `description`
 * avec le message d'erreur technique pour aider le debug.
 */
export function error(message: string, opts?: HermesToastOptions) {
  return sonnerToast.error(message, opts);
}

/**
 * Toast d'information — événement neutre.
 */
export function info(message: string, opts?: HermesToastOptions) {
  return sonnerToast.info(message, opts);
}

/**
 * Toast d'avertissement — action réussie mais avec réserve
 * (ex: "Post publié mais 2 invitations ont échoué").
 */
export function warning(message: string, opts?: HermesToastOptions) {
  return sonnerToast.warning(message, opts);
}

/**
 * Toast de chargement — pour les actions longues. Retourne un ID
 * à passer à `success`/`error` pour remplacer le toast loading.
 *
 * Usage:
 *   const id = toast.loading("Publication en cours…");
 *   try {
 *     await api();
 *     toast.success("Publié", { id });
 *   } catch (e) {
 *     toast.error("Échec", { id, description: e.message });
 *   }
 */
export function loading(message: string, opts?: HermesToastOptions) {
  return sonnerToast.loading(message, opts);
}

/**
 * Promise wrapper — affiche loading → success/error automatiquement.
 *
 * Usage:
 *   toast.promise(
 *     fetch("/api/data/leads").then(r => r.json()),
 *     {
 *       loading: "Chargement des leads…",
 *       success: "Leads chargés",
 *       error: "Échec du chargement",
 *     },
 *   );
 */
export function promise<T>(
  promise: Promise<T>,
  msgs: {
    loading?: string;
    success?: string | ((data: T) => string);
    error?: string | ((err: unknown) => string);
  },
) {
  return sonnerToast.promise(promise, msgs);
}

// Re-export the raw sonner toast for advanced usage
export const toast = {
  success,
  error,
  info,
  warning,
  loading,
  promise,
  // Direct sonner access for custom cases
  custom: sonnerToast,
};
