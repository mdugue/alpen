import { Explorer } from "@/components/explorer";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/brand";
import {
  getClimate,
  getPasses,
  getProfiles,
  getRoutes,
  getTours,
  getTowns,
} from "@/lib/data";

/**
 * Structured data for the map page. Deliberately without ratings or reviews:
 * the 1–5 scales are editorial judgements (docs/scales.md) and must not show up
 * as measured values in a search result either.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: siteUrl,
  description: SITE_DESCRIPTION,
  applicationCategory: "TravelApplication",
  browserRequirements: "Requires JavaScript and WebGL.",
  inLanguage: "de",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
  author: {
    "@type": "Person",
    name: "Manuel Dugué",
    url: "https://manuel.fyi",
  },
  about: { "@type": "Place", name: "Alpen" },
};

/**
 * Everything on this page is static: the data lives in the repo, is loaded at
 * build time and managed as cached segments via "use cache" (lib/data.ts).
 * This lets Next prerender the page completely; the only dynamic part is the
 * weather request in the detail panel (own route with its own cache lifetime).
 *
 * The map is the page: no header, no footer – the title lives in the sidebar
 * and the disclaimer in the scales dialog.
 */
export default async function Page() {
  "use cache";

  const [passes, tours, towns, routes, profiles, climate] = await Promise.all([
    getPasses(),
    getTours(),
    getTowns(),
    getRoutes(),
    getProfiles(),
    getClimate(),
  ]);

  return (
    <main className="h-dvh overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Explorer
        passes={passes}
        tours={tours}
        towns={towns}
        routes={routes}
        profiles={profiles}
        climate={climate}
      />
    </main>
  );
}
