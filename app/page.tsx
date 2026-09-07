import { Explorer } from "@/components/explorer";
import { SiteHeader } from "@/components/site-header";
import { getClimate, getPasses, getProfiles, getRoutes, getTours, getTowns } from "@/lib/data";

/**
 * Everything on this page is static: the data lives in the repo, is loaded at
 * build time and managed as cached segments via "use cache" (lib/data.ts).
 * This lets Next prerender the page completely; the only dynamic part is the
 * weather request in the detail panel (own route with its own cache lifetime).
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
    <main className="flex min-h-dvh flex-col">
      <SiteHeader />
      <Explorer
        passes={passes}
        tours={tours}
        towns={towns}
        routes={routes}
        profiles={profiles}
        climate={climate}
      />
      <footer className="px-4 pb-6 text-xs text-muted-foreground">
        Höhen und Auffahrtsdaten sind gerundete Richtwerte. Schönheit, Bekanntheit, Schwierigkeit und Verkehr
        sind redaktionelle 1–5-Einschätzungen. Der Status je Zeitraum ist eine Heuristik und ersetzt keine
        amtliche Sperrauskunft. Kartendaten © OpenStreetMap-Mitwirkende.
      </footer>
    </main>
  );
}
