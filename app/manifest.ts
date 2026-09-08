import type { MetadataRoute } from "next";
import { BRAND, SITE_CLAIM, SITE_NAME, SITE_TAGLINE } from "@/lib/brand";

/**
 * Web manifest, so the map can be added to a home screen and opens without
 * browser chrome – handy on a phone at the roadside. Icons point at the
 * generated routes (app/icon.tsx, app/apple-icon.tsx); the colours mirror the
 * light theme, because a manifest has no media queries.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE_NAME} – ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: SITE_CLAIM,
    lang: "de",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND.paper,
    theme_color: BRAND.paper,
    categories: ["travel", "sports", "navigation"],
    // "any" only: the badge runs edge to edge, so a maskable circular crop
    // would cut the range off its baseline (see app/apple-icon.tsx).
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
