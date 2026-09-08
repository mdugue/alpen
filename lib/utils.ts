export { cn } from "cn";

/** Formats a number using German locale conventions (e.g. "2.764"). */
export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });

/** Number plus unit with a non-breaking space: "2.757 m", "24,3 km". */
export const fmtUnit = (n: number, unit: string, digits = 0) =>
  `${fmt(n, digits)} ${unit}`;

/**
 * The mira preset renders a pressed Toggle as a faint `bg-muted`; where the
 * state must be unmistakable (map tools, status chips) the pressed state is
 * painted with the primary colour instead.
 */
export const PRESSED =
  "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground";

/** Opaque surface for controls floating over map tiles (outline buttons are translucent in dark mode). */
export const MAP_CONTROL = "bg-card shadow-md dark:bg-card";

/**
 * Translucent floating panel over the map – the sidebar, the detail slide-over
 * and the period scrubber are the same surface, so the map reads as the page
 * they float on.
 */
export const PANEL =
  "rounded-xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-md supports-not-[backdrop-filter:blur(0)]:bg-card";
