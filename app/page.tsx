import { Explorer } from "@/components/explorer";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/brand";
import { getPageData } from "@/lib/data";
import { todayPeriod } from "@/lib/status";

/**
 * Structured data for the map page. Deliberately without ratings or reviews:
 * the 1–5 scales are editorial judgements (docs/scales.md) and must not show up
 * as measured values in a search result either.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  about: { "@type": "Place", name: "Alpen" },
  applicationCategory: "TravelApplication",
  author: {
    "@type": "Person",
    name: "Manuel Dugué",
    url: "https://manuel.fyi",
  },
  browserRequirements: "Requires JavaScript and WebGL.",
  description: SITE_DESCRIPTION,
  inLanguage: "de",
  isAccessibleForFree: true,
  name: SITE_NAME,
  offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
  url: siteUrl,
};

/**
 * Everything on this page is static: the data lives in the repo, is loaded at
 * build time and managed as cached segments via "use cache" (lib/data.ts).
 * This lets Next prerender the page completely; the only dynamic part is the
 * weather request in the detail panel (own route with its own cache lifetime).
 * Neither the route geometry nor the profiles and photos are part of the page:
 * MapLibre fetches the lines as static GeoJSON (`public/map`) and the panel
 * fetches the selected entity's detail file (`public/detail`); the page only
 * carries the URLs.
 *
 * The map is the page: no header, no footer – the title lives in the sidebar
 * and the disclaimer in the scales dialog.
 *
 * The half-month the app opens on is computed here, in Europe/Berlin: the
 * cached page is revalidated within 15 minutes, so the prerendered HTML is
 * never more than that behind the calendar and the first paint shows no flash
 * of some other period. A hash or the visitor's stored choice wins over it in
 * the client (see `Explorer`).
 */
const Page = async () => {
  "use cache";

  const data = await getPageData();

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
        Zur Karte springen
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Explorer data={data} defaultPeriod={todayPeriod()} />
    </main>
  );
};

export default Page;
