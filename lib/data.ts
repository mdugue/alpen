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

export const getPasses = async (): Promise<Pass[]> => {
  "use cache";
  return passes;
};

export const getTours = async (): Promise<Tour[]> => {
  "use cache";
  return tours;
};

export const getTowns = async (): Promise<Town[]> => {
  "use cache";
  return towns;
};

/** Routed road geometry per ascent, key: `${passSlug}:${index}`. */
export const getRoutes = async (): Promise<Record<string, RouteGeometry>> => {
  "use cache";
  return routes;
};

/** Elevation profiles per ascent, same key as getRoutes. */
export const getProfiles = async (): Promise<
  Record<string, ElevationProfile>
> => {
  "use cache";
  return profiles;
};

/** Climate series per pass slug (24 half-months). */
export const getClimate = async (): Promise<Record<string, ClimateYear>> => {
  "use cache";
  return climate;
};

export const getPass = async (slug: string): Promise<Pass | undefined> => {
  "use cache";
  return passes.find((p) => p.slug === slug);
};
