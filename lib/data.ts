import "server-only";
import climateJson from "@/data/generated/climate.json";
import profilesJson from "@/data/generated/profiles.json";
import routesJson from "@/data/generated/routes.json";
import passesJson from "@/data/passes.json";
import toursJson from "@/data/tours.json";
import townsJson from "@/data/towns.json";
import * as S from "@/lib/schema";
import type {
  ClimateYear,
  ElevationProfile,
  Pass,
  RouteGeometry,
  Tour,
  Town,
} from "@/lib/types";

/**
 * All data is static and lives in the repo. It is imported at build time –
 * no network access, no revalidation needed. The functions are async +
 * "use cache" so that Cache Components treat them as cached segments and the
 * page is prerendered completely.
 *
 * Every file is parsed against its schema once, when this module loads on the
 * server; a file that does not match fails `next build` instead of the UI.
 */
const passes: Pass[] = S.Passes.parse(passesJson);
const tours: Tour[] = S.Tours.parse(toursJson);
const towns: Town[] = S.Towns.parse(townsJson);
const routes: Record<string, RouteGeometry> = S.Routes.parse(routesJson);
const profiles: Record<string, ElevationProfile> =
  S.Profiles.parse(profilesJson);
const climate: Record<string, ClimateYear> = S.Climate.parse(climateJson);

export async function getPasses(): Promise<Pass[]> {
  "use cache";
  return passes;
}

export async function getTours(): Promise<Tour[]> {
  "use cache";
  return tours;
}

export async function getTowns(): Promise<Town[]> {
  "use cache";
  return towns;
}

/** Routed road geometry per ascent, key: `${passSlug}:${index}`. */
export async function getRoutes(): Promise<Record<string, RouteGeometry>> {
  "use cache";
  return routes;
}

/** Elevation profiles per ascent, same key as getRoutes. */
export async function getProfiles(): Promise<Record<string, ElevationProfile>> {
  "use cache";
  return profiles;
}

/** Climate series per pass slug (24 half-months). */
export async function getClimate(): Promise<Record<string, ClimateYear>> {
  "use cache";
  return climate;
}

export async function getPass(slug: string): Promise<Pass | undefined> {
  "use cache";
  return passes.find((p) => p.slug === slug);
}
