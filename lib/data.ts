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
import { DETAIL_ASSET_DIR, detailAssets } from "@/lib/detail-assets";
import type { DetailAssets } from "@/lib/detail-assets";
import { MAP_ASSET_DIR, mapAssets } from "@/lib/map-assets";
import type { MapAssets } from "@/lib/map-assets";
import { nearbyTours, townReach } from "@/lib/nearby";
import type { NearbyTours, TownReach } from "@/lib/nearby";
import type { PageData } from "@/lib/page-data";
import { profilesWithCoords, valleyElevations } from "@/lib/profile";
import * as S from "@/lib/schema";
import { passYear, signalsOf, tourYear } from "@/lib/status";
import type { Signals, Year, Years } from "@/lib/status";
import type {
  ClimateYear,
  ElevationProfile,
  Pass,
  Photos,
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
 * Two of the files never leave the server as props, because both are read for
 * one entity at a time while the page would carry all of them:
 *
 *   - the route geometry, which MapLibre loads as static GeoJSON from
 *     `public/map` (`scripts/build-map-assets.ts`),
 *   - the elevation profiles and the photo metadata, which the detail panel
 *     loads per entity from `public/detail`
 *     (`scripts/build-detail-assets.ts`, `lib/detail-assets.ts`).
 *
 * What the page hands the client instead is derived from them – the file URLs,
 * tour bounding boxes, which tours pass near which entity, and the valley
 * elevation of each pass. Those derivations sit inside their cached getters,
 * not at module scope: the page fills them once at prerender, while the
 * weather route, which imports `getPass` from here and starts cold on a
 * serverless instance, never runs them.
 */
const passes: Pass[] = S.Passes.parse(passesJson);
const tours: Tour[] = S.Tours.parse(toursJson);
const towns: Town[] = S.Towns.parse(townsJson);
const routes: Record<string, RouteGeometry> = S.Routes.parse(routesJson);
const climate: Record<string, ClimateYear> = S.Climate.parse(climateJson);
const profiles: Record<string, ElevationProfile> =
  S.Profiles.parse(profilesJson);
const photos: Photos = S.Photos.parse(photosJson);

const getPasses = async (): Promise<Pass[]> => {
  "use cache";
  return passes;
};

const getTours = async (): Promise<Tour[]> => {
  "use cache";
  return tours;
};

const getTowns = async (): Promise<Town[]> => {
  "use cache";
  return towns;
};

/**
 * Both asset kinds derive their file names here rather than reading a
 * manifest, so this is where a build that skipped a script (`next build`
 * instead of `bun run build`) is caught – as a build error, not as a silent
 * 404 in the visitor's browser.
 */
const assertWritten = (dir: string, names: string[], script: string) => {
  for (const name of names)
    if (!existsSync(path.join(process.cwd(), "public", dir, name)))
      throw new Error(
        `${dir}/${name} fehlt – "bun run scripts/${script}" ausführen (Teil von "bun run build")`,
      );
};

/** URLs of the GeoJSON files MapLibre loads, plus the tour bounding boxes. */
const getMapAssets = async (): Promise<MapAssets> => {
  "use cache";
  const { assets, files } = mapAssets(passes, tours, routes);
  assertWritten(
    MAP_ASSET_DIR,
    files.map((f) => f.name),
    "build-map-assets.ts",
  );
  return assets;
};

/** Tours within reach of each pass, tour start and town, see `lib/nearby.ts`. */
const getNearbyTours = async (): Promise<NearbyTours> => {
  "use cache";
  return nearbyTours(passes, tours, towns, routes);
};

/** The area each town reaches, as a hull over its passes; see `lib/nearby.ts`. */
const getTownReach = async (): Promise<TownReach> => {
  "use cache";
  return townReach(passes, towns);
};

/**
 * One URL per entity for the profiles and photos its detail panel needs
 * (`lib/detail-assets.ts`). The profiles go through `profilesWithCoords`, the
 * same function the build script runs – the file name is a hash of what it
 * returns, so the two sides have to derive it identically.
 */
const getDetailAssets = async (): Promise<DetailAssets> => {
  "use cache";
  const { assets, files } = detailAssets(
    passes,
    tours,
    towns,
    profilesWithCoords(profiles, routes),
    photos,
  );
  assertWritten(
    DETAIL_ASSET_DIR,
    files.map((f) => f.name),
    "build-detail-assets.ts",
  );
  return assets;
};

/** Climate series per pass slug (24 half-months). */
const getClimate = async (): Promise<Record<string, ClimateYear>> => {
  "use cache";
  return climate;
};

/**
 * Lowest ascent start per pass slug – the elevation the valley heat is derived
 * to (`valleyTmax`, lib/status.ts). Derived here so the client never needs the
 * profiles for it.
 */
const getValleys = async (): Promise<Record<string, number>> => {
  "use cache";
  return valleyElevations(passes, profiles);
};

/**
 * The year of every pass and of every tour: 24 cells with status, grade,
 * reasons and the snow note, plus the best window (`passYear`, lib/status.ts).
 *
 * It is the one derivation the client used to run itself, once per pass per
 * render: the row, the histogram, the season strip, the badge and the detail
 * panel each graded all 24 half-months of every pass, so a search keystroke
 * cost about 21 000 verdicts and nothing guaranteed that two of those chains
 * agreed about the same pass. Everything it reads – the pass, its climate
 * series, its valley elevation – is static, so it is computed here instead
 * (docs/plans/15-pass-year.md).
 *
 * Not a file in `data/generated/`: the series depends on the thresholds in
 * `lib/status.ts` and later on the live closure layer (docs/roadmap.md), so it
 * belongs in a cached getter that revalidates with the build rather than in
 * something committed next to the measurements.
 */
const getYears = async (): Promise<Years> => {
  "use cache";
  const signals: Signals = { climate, valleys: await getValleys() };
  const passYears: Record<string, Year> = {};
  for (const p of passes)
    passYears[p.slug] = passYear(p, signalsOf(signals, p.slug));
  const tourYears: Record<string, Year> = {};
  for (const t of tours) tourYears[t.slug] = tourYear(t, passYears);
  return { passes: passYears, tours: tourYears };
};

export const getPass = async (slug: string): Promise<Pass | undefined> => {
  "use cache";
  return passes.find((p) => p.slug === slug);
};

/**
 * Everything the page hands the client, in one await.
 *
 * The ten getters above are the page's own business – it wants all of them,
 * every time, and nothing else ever wanted one on its own. Behind this one
 * name they stay a cached segment each, so Cache Components still prerenders
 * the page in pieces, and the caller stops carrying ten names it only ever
 * passes on (docs/plans/31-panel-model.md).
 *
 * `getPass` stays separate and stays exported: the weather route imports it
 * and starts cold on a serverless instance, and the constraint at the top of
 * this file is precisely that it must not drag the derivations in.
 */
export const getPageData = async (): Promise<PageData> => {
  "use cache";
  const [
    passList,
    tourList,
    townList,
    assets,
    nearby,
    reach,
    detail,
    climateOf,
    valleys,
    years,
  ] = await Promise.all([
    getPasses(),
    getTours(),
    getTowns(),
    getMapAssets(),
    getNearbyTours(),
    getTownReach(),
    getDetailAssets(),
    getClimate(),
    getValleys(),
    getYears(),
  ]);
  return {
    assets,
    climate: climateOf,
    detail,
    nearbyTours: nearby,
    passes: passList,
    tours: tourList,
    townReach: reach,
    towns: townList,
    valleys,
    years,
  };
};
