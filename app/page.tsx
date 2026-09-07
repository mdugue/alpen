import { Explorer } from "@/components/explorer";
import { SiteHeader } from "@/components/site-header";
import { getClimate, getPasses, getProfiles, getRoutes, getTours, getTowns } from "@/lib/data";

/**
 * Alles auf dieser Seite ist statisch: die Daten liegen im Repo, werden zur
 * Build-Zeit geladen und über "use cache" (lib/data.ts) als gecachte Segmente
 * geführt. Damit prerendert Next die Seite vollständig; dynamisch ist nur die
 * Wetterabfrage im Detailpanel (eigene Route mit eigener Cache-Lebensdauer).
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
