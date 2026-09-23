import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/brand";
import { routeOf, WISSEN, WISSEN_DEV } from "@/lib/docs/routes";

import { pageFiles } from "./wissen/_lib/docs";

/**
 * The app is a single page – filters, period and selection live in the URL
 * fragment, which crawlers neither see nor need. So the map is exactly one
 * entry, plus the share image so it can be picked up as an image result. Once
 * entities get real routes (`docs/plans/02-real-routes.md`), they belong here.
 *
 * The knowledge base under /wissen is prerendered page by page from docs/,
 * so each of its pages is an entry: the German guide above the English
 * developer docs in priority.
 *
 * /impressum and /datenschutz are deliberately missing: they are `noindex`
 * (see their metadata), and a sitemap is a request to index.
 *
 * Evaluated once at build time – the data is baked into the bundle, so a new
 * deployment is the only thing that changes the content.
 */
const BUILD_TIME = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "weekly",
      images: [`${siteUrl}/opengraph-image`],
      lastModified: BUILD_TIME,
      priority: 1,
      url: siteUrl,
    },
    ...[
      ...new Set([
        WISSEN,
        WISSEN_DEV,
        ...pageFiles().map((f) => routeOf(f) ?? WISSEN),
      ]),
    ].map((route) => ({
      changeFrequency: "monthly" as const,
      lastModified: BUILD_TIME,
      priority: route.startsWith(WISSEN_DEV) ? 0.3 : 0.6,
      url: `${siteUrl}${route}`,
    })),
  ];
}
