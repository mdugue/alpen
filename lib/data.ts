import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

import climateJson from "@/data/generated/climate.json";
import photosJson from "@/data/generated/photos.json";
import profilesJson from "@/data/generated/profiles.json";
import routesJson from "@/data/generated/routes.json";
import passesJson from "@/data/passes.json";
import toursJson from "@/data/tours.json";
import townsJson from "@/data/towns.json";
import { MAP_ASSET_DIR, mapAssets } from "@/lib/map-assets";
import type { MapAssets } from "@/lib/map-assets";
import { nearbyTours, townReach } from "@/lib/nearby";
import type { NearbyTours, TownReach } from "@/lib/nearby";
import { profileCoords } from "@/lib/profile";
import * as S from "@/lib/schema";
import type {
  ClimateYear,
  ElevationProfile,
  Pass,
  Photos,
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
 * derived from it – the file URLs, tour bounding boxes, which tours pass near
 * which entity, and the road coordinate of each profile sample. Those
 * derivations sit inside their cached getters, not at module scope: the page
 * fills them once at prerender, while the weather route, which imports
 * `getPass` from here and starts cold on a serverless instance, never runs
 * them.
 */
const passes: Pass[] = S.Passes.parse(passesJson);
const tours: Tour[] = S.Tours.parse(toursJson);
const towns: Town[] = S.Towns.parse(townsJson);
const routes: Record<string, RouteGeometry> = S.Routes.parse(routesJson);
const climate: Record<string, ClimateYear> = S.Climate.parse(climateJson);
const profiles: Record<string, ElevationProfile> =
  S.Profiles.parse(profilesJson);
const photos: Photos = S.Photos.parse(photosJson);

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

/**
 * URLs of the GeoJSON files MapLibre loads, plus the tour bounding boxes.
 * The names are derived, not read from a manifest, so this is where a build
 * that skipped the script (`next build` instead of `bun run build`) is caught
 * – as a build error, not as a silent 404 in the visitor's browser.
 */
export const getMapAssets = async (): Promise<MapAssets> => {
  "use cache";
  const { assets, files } = mapAssets(passes, tours, routes);
  for (const f of files) {
    const file = path.join(process.cwd(), "public", MAP_ASSET_DIR, f.name);
    if (!existsSync(file))
      throw new Error(
        `${MAP_ASSET_DIR}/${f.name} fehlt – "bun run scripts/build-map-assets.ts" ausführen (Teil von "bun run build")`,
      );
  }
  return assets;
};

/** Tours within reach of each pass, tour start and town, see `lib/nearby.ts`. */
export const getNearbyTours = async (): Promise<NearbyTours> => {
  "use cache";
  return nearbyTours(passes, tours, towns, routes);
};

/** The area each town reaches, as a hull over its passes; see `lib/nearby.ts`. */
export const getTownReach = async (): Promise<TownReach> => {
  "use cache";
  return townReach(passes, towns);
};

/** Elevation profiles per ascent, key as `routes.json`, with their sample coordinates. */
export const getProfiles = async (): Promise<
  Record<string, ProfileWithCoords>
> => {
  "use cache";
  return Object.fromEntries(
    Object.entries(profiles).map(([key, p]) => [
      key,
      { ...p, coords: routes[key] ? profileCoords(routes[key]) : undefined },
    ]),
  );
};

/** Climate series per pass slug (24 half-months). */
export const getClimate = async (): Promise<Record<string, ClimateYear>> => {
  "use cache";
  return climate;
};

/** Commons photos per entity, keyed by `photoKey` (see `lib/photos.ts`). */
export const getPhotos = async (): Promise<Photos> => {
  "use cache";
  return photos;
};

export const getPass = async (slug: string): Promise<Pass | undefined> => {
  "use cache";
  return passes.find((p) => p.slug === slug);
};
