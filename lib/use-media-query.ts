"use client";
import { useSyncExternalStore } from "react";

/**
 * SSR-safe media query. The server snapshot is `false`, so the prerendered
 * HTML always carries the desktop layout; phones switch after hydration.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below this width the sidebar becomes a bottom sheet (Tailwind `lg`). */
export const MOBILE_QUERY = "(width < 64rem)";
