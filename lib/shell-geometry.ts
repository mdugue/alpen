/**
 * What the shell leaves of the map, as one calculation.
 *
 * The map fills the viewport and everything else floats over it, so every
 * number the shell is laid out with is a number the camera needs as well: what
 * a panel covers on the left, what the two bars cover at the top and the
 * bottom, what the drawer in front of the map takes on a phone
 * (docs/ui-conventions.md, "The map is the page, and the shell is over it").
 *
 * They used to be written in four languages – pixel constants beside the
 * Tailwind widths they had to match, a `right-40` for the corner the
 * attribution sits in, a copy of the drawer's own inset – and a comment asking
 * for them to be kept in sync was all that held them together. Here they are
 * one table: the arithmetic reads the numbers, the classes read the custom
 * properties `vars` carries, and neither can drift from the other.
 */

import type { Inset } from "@/lib/map-camera";

/** The gap the floating panels keep from the edge and from each other (`*-3`). */
const GAP = 12;

/**
 * How wide the two floating panels are, per desktop step. The detail panel
 * grows with the viewport like the sidebar does, and the map keeps the larger
 * half at both widths.
 */
const PANEL_W = {
  detail: { lg: 352, xl: 400 },
  sidebar: { lg: 384, xl: 416 },
};

/**
 * What the scale bar and the attribution need of the bottom-right corner on
 * desktop. The season card stops short of it rather than covering the one
 * corner the provenance controls have to themselves.
 */
const CORNER_W = 160;

/** The two translucent bars, as measured (`useHeight` in `explorer.tsx`). */
export interface ShellBars {
  /** The header along the top, whose height is the map's top padding. */
  header: number;
  /** The season bar: an edge-to-edge bar on a phone, a card on desktop. */
  season: number;
}

export interface ShellViewport {
  /** Below `lg`: the sidebar is a drawer and the season bar runs along the edge. */
  mobile: boolean;
  /** From `xl` (80rem) on, where both panels take their wider step. */
  wide: boolean;
  /** Viewport height in px, which a snap point below 1 is a fraction of. */
  height: number;
}

/** Whichever drawer is in front of the map, and how far up it is. */
export interface ShellSheet {
  /**
   * Its snap point: Base UI reads one above 1 as pixels and one below it as a
   * fraction of the viewport. `0` for no sheet at all.
   */
  snap: number;
  /**
   * What the drawer keeps free of the viewport edge – its own `--drawer-inset`,
   * measured off a mounted popup (`useSheetInset`, components/mobile-sheet.tsx)
   * rather than copied: the token is set in `components/ui/drawer.tsx`, which
   * `bun run ui:init` rewrites.
   */
  inset: number;
}

/** Which of the two floating panels are open on desktop. */
export interface ShellPanels {
  sidebar: boolean;
  detail: boolean;
}

export interface ShellInput {
  bars: ShellBars;
  viewport: ShellViewport;
  sheet: ShellSheet;
  panels: ShellPanels;
}

export interface Shell {
  /** What the shell covers of the map, and thus the camera's padding. */
  inset: Inset;
  /**
   * Where the floating panels stand, for the classes that need it: the panel
   * widths, the detail panel's left edge, where the season card starts and
   * stops, and how far MapLibre's corner controls are lifted off the bottom
   * edge. Set on the shell's root element, read with `w-(--shell-sidebar)` and
   * its like, so no width is spelled twice.
   */
  vars: Record<string, string>;
}

/**
 * What an open sheet covers of the map, in pixels – its snap point plus the
 * margin it keeps to the screen edge. `0` for no sheet at all.
 *
 * The camera padding is arithmetic and can read neither Base UI's two ways of
 * spelling a snap point nor the custom property the margin comes from, so both
 * are converted here.
 */
export const sheetCover = (
  sheet: ShellSheet,
  viewportHeight: number,
): number =>
  sheet.snap
    ? (sheet.snap <= 1 ? Math.round(sheet.snap * viewportHeight) : sheet.snap) +
      sheet.inset
    : 0;

/**
 * Where everything the shell draws stands, and what it takes from the map.
 *
 * The bars are translucent, so the map runs on underneath them and a camera
 * target behind one is simply unreadable – which is why what they cover is
 * measured rather than promised. On a phone whichever drawer is in front covers
 * more than the season bar does, and that is what counts then.
 */
export const shellGeometry = ({
  bars,
  panels,
  sheet,
  viewport,
}: ShellInput): Shell => {
  const step = viewport.wide ? "xl" : "lg";
  const sidebar = PANEL_W.sidebar[step];
  const detail = PANEL_W.detail[step];

  // Desktop: the panels float over the map; the map is padded by their width
  // so camera targets land in the visible part.
  const open = viewport.mobile
    ? []
    : [panels.sidebar ? sidebar : 0, panels.detail ? detail : 0].filter(
        Boolean,
      );
  const left = open.reduce((x, w) => x + w + GAP, open.length ? GAP : 0);
  const detailLeft =
    GAP + (!viewport.mobile && panels.sidebar ? sidebar + GAP : 0);

  // Where the season bar stands on the map's bottom edge, and what it takes.
  // On a phone it is a bar along the edge: the corner controls stand on it and
  // nothing stands left of it. On desktop it is a card a gap above the edge,
  // right beside the panels or at the gap when none is open; it leaves the
  // bottom-right corner free, so the controls sit at the edge there.
  const controls = viewport.mobile ? bars.season : 0;
  const cover = viewport.mobile ? bars.season : bars.season + GAP;
  const cardLeft = viewport.mobile ? 0 : left || GAP;

  const bottom = Math.max(sheetCover(sheet, viewport.height), cover);

  return {
    inset: { bottom, left, right: 0, top: bars.header },
    vars: {
      "--shell-bottom": `${controls}px`,
      "--shell-detail": `${detail}px`,
      "--shell-detail-left": `${detailLeft}px`,
      "--shell-left": `${cardLeft}px`,
      "--shell-right": `${CORNER_W}px`,
      "--shell-sidebar": `${sidebar}px`,
    },
  };
};
