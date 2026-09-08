import "server-only";
import climateJson from "@/data/generated/climate.json";
import profilesJson from "@/data/generated/profiles.json";
import routesJson from "@/data/generated/routes.json";
import passesJson from "@/data/passes.json";
import toursJson from "@/data/tours.json";
import townsJson from "@/data/towns.json";
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
 */

export async function getPasses(): Promise<Pass[]> {
  "use cache";
  return passesJson as Pass[];
}

export async function getTours(): Promise<Tour[]> {
  "use cache";
  return toursJson as Tour[];
}

export async function getTowns(): Promise<Town[]> {
  "use cache";
  return townsJson as Town[];
}

/** Routed road geometry per ascent, key: `${passSlug}:${index}`. */
export async function getRoutes(): Promise<Record<string, RouteGeometry>> {
  "use cache";
  // JSON imports are inferred as number[][]; narrow via unknown to the tuple type.
  return routesJson as unknown as Record<string, RouteGeometry>;
}

/** Elevation profiles per ascent, same key as getRoutes. */
export async function getProfiles(): Promise<Record<string, ElevationProfile>> {
  "use cache";
  return profilesJson as unknown as Record<string, ElevationProfile>;
}

/** Climate series per pass slug (24 half-months). */
export async function getClimate(): Promise<Record<string, ClimateYear>> {
  "use cache";
  return climateJson as unknown as Record<string, ClimateYear>;
}

export async function getPass(slug: string): Promise<Pass | undefined> {
  "use cache";
  return (passesJson as Pass[]).find((p) => p.slug === slug);
}
