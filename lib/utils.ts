export { cn } from "cn";

/** Formats a number using German locale conventions (e.g. "2.764"). */
export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("de-DE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
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

/**
 * The mira preset has no icon-only Toggle size; this squares a default-size
 * Toggle to match Button's `icon` (size-7) so star and map toggles line up
 * with the buttons next to them.
 */
export const ICON_TOGGLE = "size-7 px-0";

/**
 * Controls a thumb operates. The axis is the pointer, not the viewport: a
 * coarse pointer needs a bigger target, and it is also where every form control
 * is forced to a 16 px font (see `app/globals.css`) that the dense desktop
 * height would clip. With a mouse the sizes stay as they are.
 */
export const TOUCH_CONTROL = "pointer-coarse:h-9";
/**
 * The same for `NativeSelect`, whose `className` lands on the wrapper, not on
 * the control – and whose own `data-[size=sm]` height is more specific than a
 * plain child selector, hence the important modifier.
 */
export const TOUCH_SELECT = "pointer-coarse:[&>select]:h-9!";
/** The same for icon-only buttons and toggles, which have no label to aim at. */
export const TOUCH_ICON = "pointer-coarse:size-9";

/** Opaque surface for controls floating over map tiles (outline buttons are translucent in dark mode). */
export const MAP_CONTROL = "bg-card shadow-md dark:bg-card";

/**
 * One map tool. The three sit in a segmented group next to the period
 * scrubber, in the same outline as its stepper – a tool has to look pressable,
 * and a bare icon on the panel does not. `Button` and `Toggle` disagree about
 * that outline in the mira preset (`hover:bg-input/50` against
 * `hover:bg-muted`, `border-border` against `border-input`, a dark fill on one
 * and not the other), so all three are settled on the button's side here.
 */
export const MAP_TOOL =
  "border-border hover:bg-input/50 hover:text-foreground dark:bg-input/30";

/**
 * Translucent floating panel over the map – the sidebar, the detail slide-over
 * and the period scrubber are the same surface, so the map reads as the page
 * they float on.
 */
export const PANEL =
  "rounded-xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-md supports-not-[backdrop-filter:blur(0)]:bg-card";

/**
 * A group of controls floating over the map, on the panel surface: the period
 * scrubber and the map tools next to it share it, which is what makes the
 * top-left corner read as one interaction area rather than as loose buttons.
 */
export const MAP_CLUSTER = `${PANEL} p-1.5`;
