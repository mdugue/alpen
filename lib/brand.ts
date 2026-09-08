/**
 * The identity shared by everything that lives outside the app shell: the
 * generated icons, the share image, the web manifest, robots.txt and the
 * sitemap.
 *
 * Neither Satori (next/og) nor a manifest can read CSS custom properties, so
 * the sRGB equivalents of the tokens in app/globals.css are spelled out here –
 * one place to change instead of six. Keep them in sync when the palette moves.
 */

export const SITE_NAME = "Alpenpässe";
export const SITE_TAGLINE = "Rennradkarte";
export const SITE_TITLE = `${SITE_NAME} – ${SITE_TAGLINE}`;

/**
 * The app is a planning aid for holidays, not a navigation tool – the
 * description says so, because that is what people search for.
 */
export const SITE_DESCRIPTION =
  "Wohin mit dem Rennrad, und wann? Alpenpässe, Auffahrten mit Höhenprofil, Rundtouren und Rad-Orte auf einer Karte – mit Befahrbarkeit je Halbmonat, Wetter und Klima.";

/** Short form for the share image and the manifest, where space is tight. */
export const SITE_CLAIM = "Pässe, Rundtouren und Rad-Orte in den Alpen – nach Befahrbarkeit je Halbmonat.";

/**
 * Absolute base URL. Vercel provides the production host; a preview deployment
 * or a local run falls back to its own origin, so share images and the sitemap
 * never point at production from a branch.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

/** sRGB equivalents of the light-theme tokens in app/globals.css. */
export const BRAND = {
  paper: "#fbfaf7",
  ink: "#2b2a27",
  primary: "#2f3d55",
  muted: "#8a8275",
  accent: "#e8b45a",
  /** --background in the dark theme, used as the dark browser chrome colour. */
  night: "#1a1c22",
  status: {
    open: "#4a9a6a",
    risky: "#e0a93f",
    closed: "#c0463e",
  },
} as const;

/**
 * The mark: a ridge line over two summits with the col in between and a dot on
 * the col – a pass, reduced to the two strokes that still read at 16 px. Drawn
 * on a 100 × 100 grid so every rendering can pick its own stroke width.
 */
export const MARK = {
  ridge: "M10 78 L32 32 L50 54 L70 24 L90 78",
  col: { x: 50, y: 54 },
} as const;
