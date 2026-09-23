import type { MetadataRoute } from "next";

import { BRAND, SITE_NAME } from "@/lib/brand";
import { DEFAULT_LANG } from "@/lib/i18n";
import { messagesOf } from "@/lib/i18n/dictionaries";

/**
 * Web manifest, so the map can be added to a home screen and opens without
 * browser chrome – handy on a phone at the roadside. Icons point at the
 * generated routes (app/icon.tsx, app/apple-icon.tsx); the colours mirror the
 * light theme, because a manifest has no media queries. One manifest for the
 * site, so it speaks the default language and starts on its canonical root.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { site } = messagesOf(DEFAULT_LANG);
  return {
    background_color: BRAND.day,
    categories: ["travel", "sports", "navigation"],
    description: site.claim,
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
    lang: DEFAULT_LANG,
    name: site.title,
    scope: "/",
    short_name: SITE_NAME,
    start_url: "/",
    theme_color: BRAND.day,
  };
}
