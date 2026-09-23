import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

import destinationsJson from "@/data/destinations.json";
import climateJson from "@/data/generated/climate.json";
import photosJson from "@/data/generated/photos.json";
import profilesJson from "@/data/generated/profiles.json";
import routesJson from "@/data/generated/routes.json";
import destinationsEn from "@/data/i18n/en/destinations.json";
import passesEn from "@/data/i18n/en/passes.json";
import toursEn from "@/data/i18n/en/tours.json";
import townsEn from "@/data/i18n/en/towns.json";
import passesJson from "@/data/passes.json";
import toursJson from "@/data/tours.json";
import townsJson from "@/data/towns.json";
import type { Selection } from "@/lib/app-state";
import { membersOf } from "@/lib/destination";
import type { DestinationMembers } from "@/lib/destination";
import { DETAIL_ASSET_DIR, detailAssets } from "@/lib/detail-assets";
import type { DetailAssets } from "@/lib/detail-assets";
import { DEFAULT_LANG } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { MAP_ASSET_DIR, mapAssets } from "@/lib/map-assets";
import type { MapAssets } from "@/lib/map-assets";
import { nearbyTours, townRanges, townReach } from "@/lib/nearby";
import type { NearbyTours, TownReach } from "@/lib/nearby";
import type { PageData } from "@/lib/page-data";
import { profilesWithCoords, valleyElevations } from "@/lib/profile";
import { SEGMENT, selectionOf } from "@/lib/routes";
import type { Segment } from "@/lib/routes";
import * as S from "@/lib/schema";
import type { Entity } from "@/lib/share-text";
import { passYear, signalsOf, tourYear } from "@/lib/status";
import type { Signals, Year, Years } from "@/lib/status";
import type {
  ClimateYear,
  Destination,
  ElevationProfile,
  Pass,
  Photos,
  RouteGeometry,
  Tour,
  Town,
} from "@/lib/types";

/**
 * All data is static and lives in the repo. It is imported at build time –
 * no network access, nothing to revalidate – so nothing here is cached and
 * nothing here is async. The one cache boundary is the explorer's layout
 * (`app/[lang]/(explorer)/layout.tsx`), whose `"use cache"` covers this whole
 * module's work: what these functions derive
 * is derived once, at prerender, and lands in the page's own cache entry.
 * They used to carry a `"use cache"` each, which bought a second copy of the
 * same values in the cache store and nothing else – no getter has a lifetime,
 * a tag or a second caller to tell it apart from the page.
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
 * elevation of each pass. Those derivations sit inside the getters, not at
 * module scope: the explorer's layout runs them once at prerender, while the
 * entity routes' metadata and share images, which only look one entity up
 * (`entityAt`), never run them.
 */
const passes: Pass[] = S.Passes.parse(passesJson);
const tours: Tour[] = S.Tours.parse(toursJson);
const towns: Town[] = S.Towns.parse(townsJson);
const destinations: Destination[] = S.Destinations.parse(destinationsJson);
const routes: Record<string, RouteGeometry> = S.Routes.parse(routesJson);
const climate: Record<string, ClimateYear> = S.Climate.parse(climateJson);
const profiles: Record<string, ElevationProfile> =
  S.Profiles.parse(profilesJson);
const photos: Photos = S.Photos.parse(photosJson);

/**
 * The curated prose in English (plan 08), keyed by slug and merged over the
 * German record field by field: a field the file does not carry stays
 * German, so a half-translated entry is a German sentence in an English
 * panel rather than a blank – `data:check` counts what is still missing.
 * The German records are the only ones parsed against the full schema; the
 * merge never adds a field and never touches a name or a number.
 */
const TRANSLATIONS = {
  en: {
    destinations: S.DestinationTranslations.parse(destinationsEn),
    passes: S.PassTranslations.parse(passesEn),
    tours: S.TourTranslations.parse(toursEn),
    towns: S.TownTranslations.parse(townsEn),
  },
} satisfies Partial<Record<Lang, unknown>>;

type Translated = (typeof TRANSLATIONS)[keyof typeof TRANSLATIONS];

/** One list with the translated fields laid over each record. */
const localize = <T extends { slug: string }, P extends object>(
  list: T[],
  translations: Record<string, P>,
): T[] =>
  list.map((item) => {
    const own = translations[item.slug];
    return own ? { ...item, ...own } : item;
  });

/** A pass with its prose and its ascent labels (matched by index) in the other language. */
const localizePass = (
  pass: Pass,
  own: (typeof TRANSLATIONS)["en"]["passes"][string] | undefined,
): Pass => {
  if (!own) return pass;
  const { ascents: labels, ...prose } = own;
  return {
    ...pass,
    ...prose,
    ascents: labels
      ? pass.ascents.map((a, j) => (labels[j] ? { ...a, label: labels[j] } : a))
      : pass.ascents,
  };
};

interface Lists {
  destinations: Destination[];
  passes: Pass[];
  tours: Tour[];
  towns: Town[];
}

/**
 * The German lists, or the other language's laid over them – built once per
 * language: every prerendered route asks for its entity, and the four lists
 * do not change between two of them.
 */
const LISTS = new Map<Lang, Lists>();
const localized = (lang: Lang): Lists => {
  const cached = LISTS.get(lang);
  if (cached) return cached;
  const t: Translated | undefined =
    lang === DEFAULT_LANG
      ? undefined
      : TRANSLATIONS[lang as keyof typeof TRANSLATIONS];
  const lists: Lists = t
    ? {
        destinations: localize(destinations, t.destinations),
        passes: passes.map((p) => localizePass(p, t.passes[p.slug])),
        tours: localize(tours, t.tours),
        towns: localize(towns, t.towns),
      }
    : { destinations, passes, tours, towns };
  LISTS.set(lang, lists);
  return lists;
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
const getMapAssets = (): MapAssets => {
  const { assets, files } = mapAssets(passes, tours, routes);
  assertWritten(
    MAP_ASSET_DIR,
    files.map((f) => f.name),
    "build-map-assets.ts",
  );
  return assets;
};

/** Tours within reach of each pass, tour start and town, see `lib/nearby.ts`. */
const getNearbyTours = (): NearbyTours =>
  nearbyTours(passes, tours, towns, routes);

/**
 * What each destination holds – the roads within its radius plus its
 * `include` minus its `exclude`, the towns and loops inside it, and the box
 * around all of it (`membersOf`, lib/destination.ts). Derived here rather
 * than written by `data:build`: a road added to `passes.json` joins its area
 * without a second file to regenerate.
 */
const getDestinationMembers = (): Record<string, DestinationMembers> =>
  Object.fromEntries(
    destinations.map((d) => [d.slug, membersOf(d, passes, tours, towns)]),
  );

/** The area each town reaches, as a hull over its passes; see `lib/nearby.ts`. */
const getTownReach = (): TownReach => townReach(passes, towns);

/**
 * One URL per entity for the profiles and photos its detail panel needs
 * (`lib/detail-assets.ts`). The profiles go through `profilesWithCoords`, the
 * same function the build script runs – the file name is a hash of what it
 * returns, so the two sides have to derive it identically.
 */
const getDetailAssets = (): DetailAssets => {
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

/**
 * Lowest ascent start per pass slug – the elevation the valley heat is derived
 * to (`valleyTmax`, lib/status.ts). Derived here so the client never needs the
 * profiles for it.
 */
const getValleys = (): Record<string, number> =>
  valleyElevations(passes, profiles);

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
 * belongs with the page, which is rebuilt with them, rather than in something
 * committed next to the measurements.
 */
const getYears = (valleys: Record<string, number>): Years => {
  const signals: Signals = { climate, valleys };
  const passYears: Record<string, Year> = {};
  for (const p of passes)
    passYears[p.slug] = passYear(p, signalsOf(signals, p.slug));
  const tourYears: Record<string, Year> = {};
  for (const t of tours) tourYears[t.slug] = tourYear(t, passYears);
  return { passes: passYears, tours: tourYears };
};

/**
 * The entity behind a route (plan 02): what `generateMetadata` and the share
 * image read for one path. A find over a few hundred records, run once per
 * prerendered page; nothing here drags the derivations in.
 */
const getEntity = (selection: Selection, lang: Lang): Entity | undefined => {
  const lists = localized(lang);
  switch (selection.kind) {
    case "pass": {
      const pass = lists.passes.find((p) => p.slug === selection.slug);
      return pass && { kind: "pass", pass };
    }
    case "tour": {
      const tour = lists.tours.find((t) => t.slug === selection.slug);
      return tour && { kind: "tour", tour };
    }
    case "town": {
      const town = lists.towns.find((t) => t.slug === selection.slug);
      return town && { kind: "town", town };
    }
    case "destination": {
      const destination = lists.destinations.find(
        (d) => d.slug === selection.slug,
      );
      return destination && { destination, kind: "destination" };
    }
    default: {
      return selection.kind satisfies never;
    }
  }
};

/**
 * The entity a route's two segments name, with its selection – what the
 * page, its metadata and its share image all start from. `null` for a path
 * that names nothing, which the page turns into a 404.
 */
export const entityAt = (
  kind: string,
  slug: string,
  lang: Lang,
): { entity: Entity; selection: Selection } | null => {
  // The params arrive decoded; the path form is what `selectionOf` reads.
  const selection = selectionOf(`/${kind}/${encodeURIComponent(slug)}`);
  const entity = selection && getEntity(selection, lang);
  return selection && entity ? { entity, selection } : null;
};

/** Every entity route there is, for `generateStaticParams` and the sitemap. */
export const staticParams = (): { kind: Segment; slug: string }[] => [
  ...passes.map((p) => ({ kind: SEGMENT.pass, slug: p.slug })),
  ...tours.map((t) => ({ kind: SEGMENT.tour, slug: t.slug })),
  ...towns.map((t) => ({ kind: SEGMENT.town, slug: t.slug })),
  ...destinations.map((d) => ({ kind: SEGMENT.destination, slug: d.slug })),
];

/**
 * Everything the page hands the client, as one value.
 *
 * The derivations above are the page's own business – it wants all of them,
 * every time, and nothing else ever wanted one on its own – so the caller
 * stops carrying the names it only ever passed on
 * (docs/plans/31-panel-model.md). The four files it simply hands through are
 * read straight off the parsed constants; a getter around a constant only
 * hides which of the two a name is.
 */
export const getPageData = (lang: Lang): PageData => {
  // The valleys are walked once and handed on: the page carries them and the
  // year is graded against them, and there is no cache left to make the second
  // walk free.
  const valleys = getValleys();
  // Only the prose changes with the language; everything derived – the years,
  // the reach, the members – is derived from the German records, which carry
  // the same names, numbers and coordinates.
  const lists = localized(lang);
  return {
    assets: getMapAssets(),
    climate,
    destinationMembers: getDestinationMembers(),
    destinations: lists.destinations,
    detail: getDetailAssets(),
    nearbyTours: getNearbyTours(),
    passes: lists.passes,
    tours: lists.tours,
    townRanges: townRanges(passes, towns),
    townReach: getTownReach(),
    towns: lists.towns,
    valleys,
    years: getYears(valleys),
  };
};
