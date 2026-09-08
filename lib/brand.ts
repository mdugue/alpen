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
 * The mark: a range in four tonal planes on a warm charcoal ground, no colour
 * at all. Depth comes from tone alone – each ridge a step lighter than the one
 * behind it, the front summit at paper white – which is what carries the badge
 * down to 16 px, where a snow line or an outline would only turn to mush.
 *
 * The greys are their own small scale rather than the UI tokens: an icon is
 * seen at 16 px against unknown browser chrome and needs contrast the page
 * palette is not built for. Drawn on a 100 × 100 grid, painted back to front;
 * see lib/mark.tsx.
 */
export const MARK = {
  /** Warm charcoal with a slight tonal falloff, so the ground is not a flat slab. */
  ground: "linear-gradient(155deg, #2b2724, #151312)",
  /** Flat equivalent for anywhere a gradient cannot go. */
  groundFlat: "#211f1c",
  /**
   * Back to front. The two distant ridges run off the sides on purpose – they
   * are clipped by the viewBox at every size, so they never end in mid-air.
   */
  ridges: [
    { d: "M14 52 L44 84 L-30 84 Z", fill: "#3d3833" },
    { d: "M92 50 L140 84 L64 84 Z", fill: "#3d3833" },
    { d: "M28 40 L50 84 L6 84 Z", fill: "#736d66" },
    { d: "M64 22 L96 84 L32 84 Z", fill: BRAND.paper },
  ],
  /** Corner radius wherever the badge is drawn as a rounded square. */
  radius: "22%",
} as const;
