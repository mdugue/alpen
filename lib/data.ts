import "server-only";
import passesJson from "@/data/passes.json";
import toursJson from "@/data/tours.json";
import townsJson from "@/data/towns.json";
import routesJson from "@/data/generated/routes.json";
import profilesJson from "@/data/generated/profiles.json";
import climateJson from "@/data/generated/climate.json";
import type {
  ClimateYear,
  ElevationProfile,
  Pass,
  RouteGeometry,
  Tour,
  Town,
} from "@/lib/types";

/**
 * Alle Daten sind statisch und liegen im Repo. Sie werden zur Build-Zeit
 * importiert – kein Netzwerkzugriff, kein Revalidieren nötig. Die Funktionen
 * sind async + "use cache", damit sie in Cache Components als gecachte
 * Segmente gelten und die Seite vollständig prerendert.
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

/** Gerouteten Straßenverlauf je Auffahrt, Schlüssel: `${passSlug}:${index}`. */
export async function getRoutes(): Promise<Record<string, RouteGeometry>> {
  "use cache";
  return routesJson as Record<string, RouteGeometry>;
}

/** Höhenprofile je Auffahrt, gleicher Schlüssel wie getRoutes. */
export async function getProfiles(): Promise<Record<string, ElevationProfile>> {
  "use cache";
  return profilesJson as Record<string, ElevationProfile>;
}

/** Klimareihen je Pass-Slug (24 Halbmonate). */
export async function getClimate(): Promise<Record<string, ClimateYear>> {
  "use cache";
  return climateJson as Record<string, ClimateYear>;
}

export async function getPass(slug: string): Promise<Pass | undefined> {
  "use cache";
  return (passesJson as Pass[]).find((p) => p.slug === slug);
}
