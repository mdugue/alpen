/**
 * The app's colours as sRGB: the tokens, and the map's own tones on top of
 * them.
 *
 * Three places need a colour that no stylesheet can give them – MapLibre,
 * which cannot read a custom property, and Satori and the web manifest, which
 * render outside the document altogether (`lib/brand.ts`). They used to keep a
 * copy each, and the two copies of the same token had already drifted apart.
 * So `TOKENS` is the one mirror of `app/globals.css`, and
 * `bun run palette` (scripts/check-palette.ts) converts the stylesheet's own
 * `oklch()` values and fails on a difference – the copy cannot rot quietly any
 * more, which is the only thing that makes a copy acceptable.
 *
 * `PALETTE` is that mirror plus what exists for the basemap alone: the quiet
 * tones for land, water, wood and glaciers, the roads and the basemap's own
 * labels. Those are chosen against the tokens, not derived from them – a road
 * must sit under a status colour without competing, and the land must be a
 * shade off the panels so the panels still read as panels.
 *
 * The app's own layers (passes, ascents, tours, towns) still read their
 * colours from the live CSS tokens at runtime (`readColors` in
 * `components/map/pass-map.tsx`); this module is what the basemap and its
 * generated style files are painted with. See `lib/basemap.ts`.
 */

export type Scheme = "light" | "dark";

/**
 * The tokens of `app/globals.css`, converted to sRGB. Every key is the custom
 * property's name without its dashes, and that is not a convention the check
 * can be talked out of: `mutedForeground` is looked up as `--muted-foreground`
 * in the stylesheet, so a token renamed in one place fails in the other.
 */
export interface Tokens {
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  accent: string;
  statusOpen: string;
  statusRisky: string;
  statusClosed: string;
  tour: string;
  town: string;
}

export const TOKENS: Record<Scheme, Tokens> = {
  dark: {
    accent: "#e8aa4e",
    background: "#0d1013",
    card: "#181b1f",
    foreground: "#f0eeeb",
    mutedForeground: "#a39e94",
    primary: "#d5cdb8",
    statusClosed: "#ef6661",
    statusOpen: "#47b777",
    statusRisky: "#efac44",
    tour: "#a792ce",
    town: "#73abda",
  },
  light: {
    accent: "#ebae51",
    background: "#fbfaf7",
    card: "#ffffff",
    foreground: "#1c1713",
    mutedForeground: "#6f6860",
    primary: "#253444",
    statusClosed: "#c53637",
    statusOpen: "#258651",
    statusRisky: "#e1a035",
    tour: "#8874ae",
    town: "#2a5885",
  },
};

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

/** The token half of a scheme's palette, under the names the map uses. */
const mirror = (t: Tokens) => ({
  accent: t.accent,
  background: t.background,
  ink: t.foreground,
  muted: t.mutedForeground,
  paper: t.card,
  status: {
    closed: t.statusClosed,
    open: t.statusOpen,
    risky: t.statusRisky,
  },
  tour: t.tour,
  town: t.town,
});

export const PALETTE: Record<Scheme, MapPalette> = {
  dark: {
    ...mirror(TOKENS.dark),
    boundary: "#4d535c",
    built: "#272b32",
    glacier: "#2c3139",
    highlight: "#7c828b",
    label: "#c6c1b8",
    labelMuted: "#8f8a80",
    labelWater: "#7fa3bd",
    land: "#20242b",
    road: "#343941",
    roadCasing: "#1b1e24",
    shade: "#000000",
    water: "#151a21",
    wood: "#1e2421",
  },
  light: {
    ...mirror(TOKENS.light),
    boundary: "#b3aa9d",
    built: "#ebe6dd",
    glacier: "#f9fbfc",
    highlight: "#ffffff",
    label: "#4a453e",
    labelMuted: "#6b655c",
    labelWater: "#4a6f8a",
    land: "#f4f1ea",
    road: "#ffffff",
    roadCasing: "#d3cdc2",
    shade: "#7a7168",
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
