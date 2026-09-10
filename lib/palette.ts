/**
 * The map's colours as sRGB, one set per colour scheme.
 *
 * MapLibre cannot read CSS custom properties, so what the basemap style needs
 * is spelled out here. The first block of each scheme mirrors the tokens in
 * `app/globals.css` (keep them in sync when the palette moves; plan 11,
 * item 14, wants one module for these and the copies in `lib/brand.ts`). The
 * second block exists only for the map: the quiet tones for land, water, wood
 * and glaciers, the roads and the basemap's own labels. They are chosen
 * against the tokens, not derived from them – a road must sit under a status
 * colour without competing, and the land must be a shade off the panels so
 * the panels still read as panels.
 *
 * The app's own layers (passes, ascents, tours, towns) still read their
 * colours from the live CSS tokens at runtime (`readColors` in
 * `components/map/pass-map.tsx`); this module is what the basemap and its
 * generated style files are painted with. See `lib/basemap.ts`.
 */

export type Scheme = "light" | "dark";

export interface MapPalette {
  // --- Mirrors of app/globals.css --------------------------------------
  /** `--background` */
  background: string;
  /** `--card`: the halo behind the app's own labels. */
  paper: string;
  /** `--foreground`: the app's own labels. */
  ink: string;
  /** `--muted-foreground` */
  muted: string;
  /** `--accent` */
  accent: string;
  status: { open: string; risky: string; closed: string };
  /** `--tour` */
  tour: string;
  /** `--town` */
  town: string;

  // --- Basemap only -----------------------------------------------------
  /** Land, and the halo behind the basemap's labels. */
  land: string;
  water: string;
  wood: string;
  glacier: string;
  /** Built-up areas (OpenMapTiles `landuse` residential and friends). */
  built: string;
  /** Roads: one fill for all classes, the major ones get a casing. */
  road: string;
  roadCasing: string;
  /** Country borders. */
  boundary: string;
  /** Place names. */
  label: string;
  /** Peaks, lakes, road names – present, but one step back. */
  labelMuted: string;
  /** Lake and river names. */
  labelWater: string;
  /** Hillshade over the land, low exaggeration. */
  shade: string;
  highlight: string;
}

export const PALETTE: Record<Scheme, MapPalette> = {
  dark: {
    accent: "#e8aa4e",
    background: "#0d1013",
    boundary: "#4d535c",
    built: "#272b32",
    glacier: "#2c3139",
    highlight: "#7c828b",
    ink: "#f0eeeb",
    label: "#c6c1b8",
    labelMuted: "#8f8a80",
    labelWater: "#7fa3bd",
    land: "#20242b",
    muted: "#a39e94",
    paper: "#181b1f",
    road: "#343941",
    roadCasing: "#1b1e24",
    shade: "#000000",
    status: { closed: "#ef6661", open: "#47b777", risky: "#efac44" },
    tour: "#a792ce",
    town: "#73abda",
    water: "#151a21",
    wood: "#1e2421",
  },
  light: {
    accent: "#ebae51",
    background: "#fbfaf7",
    boundary: "#b3aa9d",
    built: "#ebe6dd",
    glacier: "#f9fbfc",
    highlight: "#ffffff",
    ink: "#1c1713",
    label: "#4a453e",
    labelMuted: "#6b655c",
    labelWater: "#4a6f8a",
    land: "#f4f1ea",
    muted: "#6f6860",
    paper: "#ffffff",
    road: "#ffffff",
    roadCasing: "#d3cdc2",
    shade: "#7a7168",
    status: { closed: "#c53637", open: "#258651", risky: "#e1a035" },
    tour: "#8874ae",
    town: "#2a5885",
    water: "#c9d6dc",
    wood: "#e2e6d8",
  },
};

/** Relative luminance per WCAG 2, from a `#rrggbb` string. */
const luminance = (hex: string): number => {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

/** WCAG 2 contrast ratio between two `#rrggbb` colours (1 to 21). */
export const contrast = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
