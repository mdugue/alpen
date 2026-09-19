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
 * plain child selector, hence the important modifier. Nothing uses it today:
 * the app has no native select left, because the 16 px the coarse-pointer rule
 * forces on one is a headline in a dense row (see the sort menu in
 * `components/sidebar/pass-list.tsx`). Kept for the next one that is genuinely
 * better native.
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
 * The one material everything over the map is made of. Defined once, because
 * the moment two of these surfaces carry different numbers the screen grows a
 * seam – the sidebar meets the header, the header meets the season bar.
 *
 * The numbers are the whole point and were measured, not guessed: at
 * `bg-card/80` over a 12 px blur, a loud backdrop came through as a faint
 * wash, so the surfaces read as closed plates rather than as glass. 70 % over
 * the same blur lets the map's structure and colour show without costing the
 * dense lists their legibility, and `backdrop-saturate-150` is what carries
 * the *colour* through – it does more for "the map is still there" than
 * another ten percent of transparency would, and it costs contrast nothing.
 *
 * Never stack two of these on top of each other: two 70 % layers compose to
 * 91 % and the result is the opaque pill this replaced (`MAP_CLUSTER`).
 */
const GLASS =
  "bg-card/70 backdrop-blur-md backdrop-saturate-150 supports-not-[backdrop-filter:blur(0)]:bg-card";

/**
 * Translucent floating panel over the map – the sidebar and the detail
 * slide-over are the same surface as the shell's two bars, so the map reads as
 * the page they all float on.
 */
export const PANEL = `rounded-xl border border-border/60 shadow-xl ${GLASS}`;

/**
 * The map's own tools, in one corner: a single glass surface with the tools
 * segmented inside it.
 *
 * It was `PANEL` plus padding, which framed the corner twice – a rounded card
 * with a rounded group sitting inside it – and read as a white ring around two
 * buttons. One frame now, and the buttons' own outlines are the dividers.
 */
export const MAP_CLUSTER = `rounded-md shadow-md ${GLASS}`;

/**
 * The shell over the map: the header along the top and the season bar along
 * the bottom. The same translucent material as `PANEL`, but edge to edge and
 * square – the map does not stop at a card, it runs on underneath. That is the
 * whole reason these two are allowed to exist at all (docs/ui-conventions.md,
 * "The map is the page").
 */
export const SHELL_BAR = `border-border/60 ${GLASS}`;

/**
 * A control lying on the panel's hero photo – the close cross, the star, the
 * carousel's two arrows.
 *
 * It carries its own surface rather than riding on a bar: the hero scrolls
 * away under these controls and what is behind them a moment later is body
 * text, so a scrim that works on a photograph would not work there, and a bar
 * that fades in on scroll is a scroll listener and a threshold for something
 * a translucent pill says on its own. Blurred and only mostly opaque, so the
 * picture underneath still reads as one picture.
 */
export const OVERLAY_CONTROL =
  "bg-card/75 shadow-sm backdrop-blur-sm hover:bg-card dark:bg-card/75 dark:hover:bg-card";
