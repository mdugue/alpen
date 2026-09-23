/**
 * The identity shared by everything that lives outside the app shell: the
 * generated icons, the share image, the web manifest, robots.txt and the
 * sitemap.
 *
 * Neither Satori (next/og) nor a manifest can read CSS custom properties, so
 * the colours come from `TOKENS` (lib/palette.ts), the one sRGB mirror of
 * app/globals.css – checked against the stylesheet by `bun run palette`. This
 * file used to keep a second copy of the same tokens, and by the time the two
 * were compared they disagreed about every one of them.
 */
import { TOKENS } from "@/lib/palette";

/**
 * The name, in every language – a name is not translated. It stays
 * "Alpenpässe" with the Jura, the Vosges and the Pyrenees in the vocabulary
 * (plans 25 and 26): the domain is `alpen.manuel.fyi`, and a rename waits for
 * a fourth range to make the stretch a lie. The tagline, the description and
 * the claim are words, so they live in the dictionaries (`site` in
 * `lib/i18n/messages.*.ts`).
 */
export const SITE_NAME = "Alpenpässe";

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

/**
 * Where the app can be supported. A donation link is the one kind of money
 * the app can carry: ads or affiliate links would break Vercel's Hobby terms
 * and Open-Meteo's free tier in the same move (see the weather route). It is
 * a plain link, never Ko-fi's widget, so nothing loads from there until it is
 * clicked – which is what the privacy page promises about it.
 */
export const SUPPORT_URL = "https://ko-fi.com/el_manu";

/**
 * The light-theme tokens under the names everything outside the shell uses.
 *
 * `day` and `night` are the two `--background` values and are named as a pair,
 * because that is what they are used as: the browser chrome colour per scheme.
 * Neither is called "paper" – that word means `--card`, the halo the map's own
 * labels sit on (`PALETTE` in lib/palette.ts), and one word naming two tokens
 * is how the copies this module replaced drifted in the first place.
 */
export const BRAND = {
  accent: TOKENS.light.accent,
  /** `--background` of the light theme, the light browser chrome colour. */
  day: TOKENS.light.background,
  ink: TOKENS.light.foreground,
  muted: TOKENS.light.mutedForeground,
  /** `--background` of the dark theme, the dark browser chrome colour. */
  night: TOKENS.dark.background,
  primary: TOKENS.light.primary,
  status: {
    closed: TOKENS.light.statusClosed,
    open: TOKENS.light.statusOpen,
    risky: TOKENS.light.statusRisky,
  },
} as const;

/**
 * The mark: a range in four tonal planes on a warm charcoal ground, no colour
 * at all. Depth comes from tone alone – each ridge a step lighter than the one
 * behind it, the front summit at the light ground – which is what carries the badge
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
  /** Corner radius wherever the badge is drawn as a rounded square. */
  radius: "22%",
  /**
   * Back to front. The two distant ridges run off the sides on purpose – they
   * are clipped by the viewBox at every size, so they never end in mid-air.
   */
  ridges: [
    { d: "M14 52 L44 84 L-30 84 Z", fill: "#3d3833" },
    { d: "M92 50 L140 84 L64 84 Z", fill: "#3d3833" },
    { d: "M28 40 L50 84 L6 84 Z", fill: "#736d66" },
    { d: "M64 22 L96 84 L32 84 Z", fill: BRAND.day },
  ],
} as const;
