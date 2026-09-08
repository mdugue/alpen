import "server-only";
import climateJson from "@/data/generated/climate.json";
import profilesJson from "@/data/generated/profiles.json";
import routesJson from "@/data/generated/routes.json";
import passesJson from "@/data/passes.json";
import toursJson from "@/data/tours.json";
import townsJson from "@/data/towns.json";
import { mapAssets } from "@/lib/map-assets";
import type { MapAssets } from "@/lib/map-assets";
import { nearbyTours } from "@/lib/nearby";
import type { NearbyTours } from "@/lib/nearby";
import { profileCoords } from "@/lib/profile";
import * as S from "@/lib/schema";
import type {
  ClimateYear,
  ElevationProfile,
  Pass,
  ProfileWithCoords,
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
 *
 * The route geometry is the one thing that never leaves the server as props:
 * MapLibre loads it as static GeoJSON from `public/map` (written by
 * `scripts/build-map-assets.ts`). What the page hands the client instead is
 * derived from it here – the file URLs, tour bounding boxes, which tours pass
 * near which entity, and the road coordinate of each profile sample.
 */
const passes: Pass[] = S.Passes.parse(passesJson);
const tours: Tour[] = S.Tours.parse(toursJson);
const towns: Town[] = S.Towns.parse(townsJson);
const routes: Record<string, RouteGeometry> = S.Routes.parse(routesJson);
const climate: Record<string, ClimateYear> = S.Climate.parse(climateJson);

const profiles: Record<string, ProfileWithCoords> = Object.fromEntries(
  Object.entries(S.Profiles.parse(profilesJson)).map(
    ([key, p]: [string, ElevationProfile]) => [
      key,
      { ...p, coords: routes[key] ? profileCoords(routes[key]) : undefined },
    ],
  ),
);

const assets: MapAssets = mapAssets(passes, tours, routes).assets;
const nearby: NearbyTours = nearbyTours(passes, tours, towns, routes);

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

/** URLs of the GeoJSON files MapLibre loads, plus the tour bounding boxes. */
export const getMapAssets = async (): Promise<MapAssets> => {
  "use cache";
  return assets;
};

/** Tours within reach of each pass, tour start and town, see `lib/nearby.ts`. */
export const getNearbyTours = async (): Promise<NearbyTours> => {
  "use cache";
  return nearby;
};

/** Elevation profiles per ascent, key `${passSlug}:${index}`, with their sample coordinates. */
export const getProfiles = async (): Promise<
  Record<string, ProfileWithCoords>
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
