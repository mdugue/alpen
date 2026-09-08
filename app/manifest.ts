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
    background_color: BRAND.paper,
    categories: ["travel", "sports", "navigation"],
    description: SITE_CLAIM,
    dir: "ltr",
    display: "standalone",
    // "any" only: the badge runs edge to edge, so a maskable circular crop
    // would cut the range off its baseline (see app/apple-icon.tsx).
    icons: [
      { sizes: "32x32", src: "/icon", type: "image/png" },
      {
        purpose: "any",
        sizes: "180x180",
        src: "/apple-icon",
        type: "image/png",
      },
    ],
    id: "/",
    lang: "de",
    name: `${SITE_NAME} – ${SITE_TAGLINE}`,
    scope: "/",
    short_name: SITE_NAME,
    start_url: "/",
    theme_color: BRAND.paper,
  };
}
