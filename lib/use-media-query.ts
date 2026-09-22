"use client";
import { useSyncExternalStore } from "react";

import type { Scheme } from "@/lib/palette";

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

/** A finger rather than a mouse: no hover, and hit areas twice the size. */
export const COARSE_QUERY = "(pointer: coarse)";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Everything about the device the map draws differently for.
 *
 * MapLibre is imperative and outlives every render, so the map used to ask the
 * platform itself – four `matchMedia` calls, one of them a verbatim copy of
 * another, inside a function documented as pure. As one prop the answers arrive
 * the way every other input does: the layers are a function of the colours and
 * this value, the camera asks it how long a move may take, and a scheme change
 * is a re-render rather than a listener the map registers on its own.
 */
export interface MapEnvironment {
  scheme: Scheme;
  coarsePointer: boolean;
  reduceMotion: boolean;
  mobile: boolean;
}

export const useMapEnvironment = (): MapEnvironment => ({
  coarsePointer: useMediaQuery(COARSE_QUERY),
  mobile: useMediaQuery(MOBILE_QUERY),
  reduceMotion: useMediaQuery(MOTION_QUERY),
  scheme: useMediaQuery(DARK_QUERY) ? "dark" : "light",
});
