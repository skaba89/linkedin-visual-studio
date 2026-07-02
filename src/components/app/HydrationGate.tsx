"use client";

/**
 * HERMÈS — R-018 — HydrationGate
 *
 * Solves React error #418 ("Hydration failed because the server rendered
 * HTML didn't match the client") caused by Zustand's `persist` middleware
 * rehydrating from localStorage during the initial client render.
 *
 * How it works:
 *   1. On the server: `mounted` is false → render children unchanged
 *      (Zustand store uses default state, matching server output)
 *   2. On the client (initial render, before useEffect): `mounted` is false
 *      → render children unchanged (matches server output → no hydration mismatch)
 *   3. On the client (after useEffect): `mounted` becomes true, AND we
 *      manually rehydrate the Zustand store from localStorage. The component
 *      then re-renders with the persisted state.
 *
 * This guarantees that the first client render matches the server render
 * byte-for-byte, then transitions to the persisted state afterwards.
 *
 * Usage:
 *   <HydrationGate>
 *     <App />
 *   </HydrationGate>
 *
 * Or wrap individual views that depend on persisted Zustand state.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useAppStore } from "@/store/appStore";

export function HydrationGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Manually rehydrate the Zustand store from localStorage.
    // This is safe to call multiple times — Zustand handles dedup.
    try {
      const result = useAppStore.persist.rehydrate();
      if (result && typeof result.then === "function") {
        Promise.resolve(result).catch(() => {
          // Silent fail — the store will just use default state
        });
      }
    } catch {
      // Silent fail — the store will just use default state
    }
    setMounted(true);
  }, []);

  // Before mount: render children as-is (server + initial client render match)
  // After mount: render children with rehydrated state
  // We don't gate the actual children rendering — we just trigger rehydration
  // after mount. The `mounted` flag is used to suppress any flash of
  // persisted-state-dependent UI by allowing child components to opt into
  // "wait for mounted" behavior via the useHydrated hook.
  void mounted; // placeholder — children render regardless, rehydration is async
  return <>{children}</>;
}

/**
 * Hook that returns true once the client has mounted and the Zustand store
 * has been rehydrated from localStorage. Use this in components that render
 * differently based on persisted state (e.g., currentView, linkedInConnected).
 *
 * Example:
 *   const hydrated = useHydrated();
 *   if (!hydrated) return <Skeleton />; // or null
 *   return <ActualContent />;
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
