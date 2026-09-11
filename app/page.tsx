import { Explorer } from "@/components/explorer";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/brand";
import {
  getClimate,
  getMapAssets,
  getNearbyTours,
  getPasses,
  getPhotos,
  getProfiles,
  getTours,
  getTownReach,
  getTowns,
  getValleys,
} from "@/lib/data";
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
 * The route geometry is not part of the page at all: MapLibre fetches it as
 * static GeoJSON (`public/map`), the page only carries the file URLs.
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

  const [
    passes,
    tours,
    towns,
    assets,
    nearbyTours,
    townReach,
    profiles,
    climate,
    valleys,
    photos,
  ] = await Promise.all([
    getPasses(),
    getTours(),
    getTowns(),
    getMapAssets(),
    getNearbyTours(),
    getTownReach(),
    getProfiles(),
    getClimate(),
    getValleys(),
    getPhotos(),
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
        assets={assets}
        nearbyTours={nearbyTours}
        townReach={townReach}
        profiles={profiles}
        climate={climate}
        valleys={valleys}
        photos={photos}
        defaultPeriod={todayPeriod()}
      />
    </main>
  );
};

export default Page;
