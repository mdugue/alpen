import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/brand";
import { staticParams } from "@/lib/data";
import { routeOf, WISSEN, WISSEN_DEV } from "@/lib/docs/routes";
import { LANGS, langPrefix } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { alternatesOf, homeHref, SEGMENT } from "@/lib/routes";

import { pageFiles } from "./wissen/_lib/docs";

/**
 * The start page and one entry per entity route (plan 02): every pass, tour,
 * town and destination has its own prerendered path, and this is where a
 * crawler is told so, with the same path in the other language beside it.
 * Filters, period and camera live in the URL fragment, which crawlers neither
 * see nor need. The share images are not listed: they are link previews, not
 * content, and their addresses are Next's to choose (the page names them).
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

/**
 * One URL of the sitemap: the page in one language, with the `hreflang`
 * entries the page's own metadata carries (`alternatesOf`), made absolute.
 */
const absolute = (path: string) => `${siteUrl}${path === "/" ? "" : path}`;

const entry = (lang: Lang, pathIn: (lang: Lang) => string) => {
  const { canonical, languages } = alternatesOf(lang, pathIn);
  return {
    alternates: {
      languages: Object.fromEntries(
        Object.entries(languages).map(([l, path]) => [l, absolute(path)]),
      ),
    },
    lastModified: BUILD_TIME,
    url: absolute(canonical),
  };
};

/**
 * The knowledge base is German and developer English, one path each: no
 * language alternates.
 */
const wissenEntries = (): MetadataRoute.Sitemap =>
  [
    ...new Set([
      WISSEN,
      WISSEN_DEV,
      ...pageFiles().map((f) => routeOf(f) ?? WISSEN),
    ]),
  ].map((route) => ({
    changeFrequency: "monthly",
    lastModified: BUILD_TIME,
    priority: route.startsWith(WISSEN_DEV) ? 0.3 : 0.6,
    url: `${siteUrl}${route}`,
  }));

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...LANGS.flatMap((lang) => [
      {
        ...entry(lang, homeHref),
        changeFrequency: "weekly" as const,
        priority: lang === "de" ? 1 : 0.9,
      },
      ...staticParams().map(({ kind, slug }) => ({
        ...entry(lang, (l) => `${langPrefix(l)}/${kind}/${slug}`),
        changeFrequency: "monthly" as const,
        priority: kind === SEGMENT.destination ? 0.8 : 0.6,
      })),
    ]),
    ...wissenEntries(),
  ];
}
