import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/brand";
import { staticParams } from "@/lib/data";
import { LANGS, langPrefix } from "@/lib/i18n";

/**
 * The start page and one entry per entity route (plan 02): every pass, tour,
 * town and destination has its own prerendered path with its own share
 * image, and this is where a crawler is told so. Filters, period and camera
 * live in the URL fragment, which crawlers neither see nor need.
 *
 * /impressum and /datenschutz are deliberately missing: they are `noindex`
 * (see their metadata), and a sitemap is a request to index.
 *
 * Evaluated once at build time – the data is baked into the bundle, so a new
 * deployment is the only thing that changes the content.
 */
const BUILD_TIME = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return LANGS.flatMap((lang) => {
    const base = `${siteUrl}${langPrefix(lang)}`;
    return [
      {
        changeFrequency: "weekly" as const,
        images: [`${base}/opengraph-image`],
        lastModified: BUILD_TIME,
        priority: lang === "de" ? 1 : 0.9,
        url: base,
      },
      ...staticParams().map(({ kind, slug }) => ({
        changeFrequency: "monthly" as const,
        images: [`${base}/${kind}/${slug}/opengraph-image`],
        lastModified: BUILD_TIME,
        priority: kind === "ziel" ? 0.8 : 0.6,
        url: `${base}/${kind}/${slug}`,
      })),
    ];
  });
}
