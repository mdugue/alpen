import { Explorer } from "@/components/explorer";
import { getClimate, getPasses, getProfiles, getRoutes, getTours, getTowns } from "@/lib/data";

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
