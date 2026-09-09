"use client";
import { useSyncExternalStore } from "react";

/**
 * SSR-safe media query. The server snapshot is `false`, so the prerendered
 * HTML always carries the desktop layout; phones switch after hydration.
 */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );

/** Below this width the sidebar becomes a bottom sheet (Tailwind `lg`). */
export const MOBILE_QUERY = "(width < 64rem)";

/**
 * Viewport height in px, kept in sync with resizes and rotations. The bottom
 * sheets are sized in `dvh` by CSS; only the map needs the same number as a
 * pixel padding, and reading `window.innerHeight` while rendering would be
 * both impure and stale. `0` on the server, where there is no viewport.
 */
export const useViewportHeight = (): number =>
  useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => window.innerHeight,
    () => 0,
  );
