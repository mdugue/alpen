import { Explorer } from "@/components/explorer";
import { I18nProvider } from "@/components/i18n";
import { SITE_NAME, siteUrl } from "@/lib/brand";
import { getPageData } from "@/lib/data";
import { langPrefix } from "@/lib/i18n";
import type { Messages } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/server";
import { todayPeriod } from "@/lib/period";
import { RANGES } from "@/lib/regions";

/**
 * Structured data for the map. Deliberately without ratings or reviews:
 * the 1–5 scales are editorial judgements (docs/scales.md) and must not show up
 * as measured values in a search result either.
 */
const jsonLd = (w: Messages) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  about: RANGES.map((r) => ({
    "@type": "Place",
    name: w.vocab.range[r].label,
  })),
  applicationCategory: "TravelApplication",
  author: {
    "@type": "Person",
    name: "Manuel Dugué",
    url: "https://manuel.fyi",
  },
  browserRequirements: "Requires JavaScript and WebGL.",
  description: w.site.description,
  inLanguage: w.lang,
  isAccessibleForFree: true,
  name: SITE_NAME,
  offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
  url: `${siteUrl}${langPrefix(w.lang)}`,
});

/**
 * The explorer is a layout, not a page (plan 02): the map, the lists and the
 * season bar stay mounted while the path under it changes from `/` to
 * `/pass/x` and back, and the child page only fills the detail slot – for a
 * pass, the weather streamed into a Suspense hole. `children` passes through
 * the `"use cache"` untouched, which is what lets the layout be prerendered
 * once for every entity route.
 *
 * Everything else here is static: the data lives in the repo and is loaded
 * at build time (lib/data.ts), and this `"use cache"` is the one boundary that
 * covers it – which lets Next prerender the layout completely. Neither the
 * route geometry nor the profiles and photos are part of it: MapLibre fetches
 * the lines as static GeoJSON (`public/map`) and the panel fetches the
 * selected entity's detail file (`public/detail`); the page only carries the
 * URLs.
 *
 * The map is the page: the header, the panels and the season bar float over
 * it (`components/shell.tsx`), and the disclaimer lives in the scales dialog.
 *
 * The half-month the app opens on is computed here, in Europe/Berlin: the
 * cached layout is revalidated within 15 minutes, so the prerendered HTML is
 * never more than that behind the calendar and the first paint shows no flash
 * of some other period. A hash or the visitor's stored choice wins over it in
 * the client (see `Explorer`).
 *
 * The words reach the client the same way the data does: as a value, one
 * language per page (`getDictionary` reads the root parameter, which makes it
 * part of this entry's cache key – the layout is prerendered once per
 * language). No component imports a dictionary, so the other language never
 * reaches the browser.
 */
const ExplorerLayout = async ({ children }: LayoutProps<"/[lang]">) => {
  "use cache";

  const w = await getDictionary();
  const data = getPageData(w.lang);

  return (
    <main className="h-dvh overflow-hidden">
      {/*
       * The first tab stop, and the only way past the sidebar without going
       * through it. The lists are composite widgets now (`lib/use-roving.ts`),
       * so Tab no longer walks 258 rows – but the filter panel alone is still
       * forty chips, and a keyboard visitor who wants the map should not have
       * to pass them.
       */}
      <a
        href="#map"
        className="bg-card text-foreground ring-ring sr-only rounded-md px-3 py-2 text-sm shadow-lg focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:ring-2"
      >
        {w.header.skipToMap}
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(w)) }}
      />
      <I18nProvider messages={w}>
        <Explorer data={data} defaultPeriod={todayPeriod()}>
          {children}
        </Explorer>
      </I18nProvider>
    </main>
  );
};

export default ExplorerLayout;
