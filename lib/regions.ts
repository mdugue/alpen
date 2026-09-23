/**
 * The fixed vocabularies of the data: ranges, regions, countries, tags, road
 * types and surfaces. Shared by the schema (server), the filters (client) and
 * the search haystacks – this module must stay free of zod so it can reach
 * the client bundle. It holds the keys only: what each is called, and the
 * hint that explains it, is `vocab` in the message files (plan 08).
 */
/**
 * One level above the region: the mountain range. A road's range is a
 * function of its region (`rangeOf`), so no data file carries it and every
 * generated key stays as it is; what the level buys is a word the search
 * knows, a chip that frames the range and a brand line that says what the
 * map covers (docs/plans/25-vosges-and-jura.md). The order is the display
 * order, the Alps first because they are where the app began.
 */
export const RANGES = ["Alpen", "Vogesen", "Jura", "Pyrenäen"] as const;

export type RangeName = (typeof RANGES)[number];

/**
 * The range the map opens on (`Scene.opening`, lib/map-scene.ts). The Alps
 * are where the app began and where most of its roads are; a range 600 km
 * away is reached through its chip, the search and a shared link, not by
 * zooming the first screen out until nothing in it is readable
 * (docs/plans/26-pyrenees.md). The fit button's second press goes to
 * `DEFAULT_VIEW`, which is centred on the same range.
 */
export const HOME_RANGE: RangeName = "Alpen";

/**
 * Which regions each range holds. The Vosges, the Jura and the Pyrenees are
 * one region each until the data asks for a split; the Alps keep their four.
 */
export const RANGE_REGIONS = {
  Alpen: ["Westalpen", "Zentralalpen", "Ostalpen", "Dolomiten"],
  Jura: ["Jura"],
  Pyrenäen: ["Pyrenäen"],
  Vogesen: ["Vogesen"],
} as const satisfies Record<RangeName, readonly string[]>;

/** The flat union, in range order – what the schema's `Region` enum is made of. */
export const REGIONS = [
  ...RANGE_REGIONS.Alpen,
  ...RANGE_REGIONS.Vogesen,
  ...RANGE_REGIONS.Jura,
  ...RANGE_REGIONS.Pyrenäen,
] as const;

/** A box in degrees, both ends inclusive. */
export interface GeoBox {
  lat: readonly [min: number, max: number];
  lon: readonly [min: number, max: number];
}

/**
 * Where each range lies. `LatLon` in the schema used to be one box around the
 * Alps – a typo guard, so a swapped pair or a missing digit fails the schema
 * instead of landing a pass in the sea. One box wide enough for the Pyrenees
 * too would catch nothing, so the guard is kept per range: a road's marker
 * and every ascent's ends have to lie inside the box of its own range, and
 * a tour's waypoints inside the box of its passes' range (`data:check`).
 * Towns are checked against the union only; their range comes from reach.
 *
 * The Vosges and the Jura lie inside the Alps' box, so the guard catches a
 * road filed on the wrong side of the 600 km between the Alps and the
 * Pyrenees, and a coordinate typed into the sea – not a Jura road filed as
 * "Westalpen". That one is the curator's to read off the map.
 */
export const RANGE_BOUNDS: Record<RangeName, GeoBox> = {
  Alpen: { lat: [43, 49], lon: [4, 16] },
  Jura: { lat: [45, 48], lon: [5, 8] },
  Pyrenäen: { lat: [42, 43.5], lon: [-2, 3.5] },
  Vogesen: { lat: [47, 49], lon: [6, 8] },
};

/** The union of every range's box: what a coordinate may be at all. */
export const LATLON_BOUNDS: GeoBox = {
  lat: [
    Math.min(...RANGES.map((r) => RANGE_BOUNDS[r].lat[0])),
    Math.max(...RANGES.map((r) => RANGE_BOUNDS[r].lat[1])),
  ],
  lon: [
    Math.min(...RANGES.map((r) => RANGE_BOUNDS[r].lon[0])),
    Math.max(...RANGES.map((r) => RANGE_BOUNDS[r].lon[1])),
  ],
};

export const inBox = (box: GeoBox, p: { lat: number; lon: number }) =>
  p.lat >= box.lat[0] &&
  p.lat <= box.lat[1] &&
  p.lon >= box.lon[0] &&
  p.lon <= box.lon[1];

export type RegionName = (typeof REGIONS)[number];

const REGION_RANGE = Object.fromEntries(
  RANGES.flatMap((range) => RANGE_REGIONS[range].map((r) => [r, range])),
) as Record<RegionName, RangeName>;

/** The range a region belongs to. */
export const rangeOf = (region: RegionName): RangeName => REGION_RANGE[region];

export const COUNTRIES = [
  "FR",
  "IT",
  "CH",
  "AT",
  "DE",
  "SI",
  "ES",
  "AD",
] as const;

/** "CH/IT" → ["CH", "IT"]. */
export const countriesOf = (country: string) => country.split("/");

/**
 * Why a town is in the list. Editorial labels, not measured facts – the same
 * honesty as the 1–5 scales: they name what a planner would notice on arrival,
 * they are not counted from a database of workshops. The order is the display
 * order; a town carries the two or three that actually apply to it.
 */
export const TOWN_TAGS = [
  "hub",
  "passes",
  "workshops",
  "hotels",
  "scenic",
  "quiet",
  "train",
  "events",
  "season",
] as const;

/**
 * What kind of road an entry is: how it lies in the terrain. Single-valued and
 * mutually exclusive, and it decides how the route quality gate measures the
 * entry (`scripts/lib/validate.ts`): if the ascents climb to the entry's own
 * point it is a `pass` or a `spur` and is measured as a climb; if the ride is
 * the traverse itself it is one of the other three and is measured the way a
 * tour is. The order is the display order in the filter and the scales dialog.
 */
export const ROAD_TYPES = [
  "pass",
  "spur",
  "plateau",
  "balcony",
  "valley",
] as const;

export type RoadTypeName = (typeof ROAD_TYPES)[number];

/**
 * The types whose ride is the traverse itself rather than a climb to the
 * entry's marker. Their ascents carry `to` and `km` and are measured against
 * the tour limits – `minPeakAt` and "ends at the summit" are the right checks
 * for a climb and the wrong ones for a road that stays up or cuts across.
 */
export const isTraverse = (type: RoadTypeName) =>
  type === "plateau" || type === "balcony" || type === "valley";

/**
 * Whether the entry's marker is the highest point of the asphalt rather than a
 * saddle with a `mountain_pass` node in OSM. Only a `pass` says so itself
 * (`roadSummit`); for every other type it follows from the type, so writing it
 * down there is redundant and `data:check` says so.
 */
export const hasRoadSummit = (road: {
  type: RoadTypeName;
  roadSummit?: boolean;
}) => road.type !== "pass" || road.roadSummit === true;

/**
 * What riding the road is like. Editorial labels in the exact sense of
 * `TOWN_TAGS` – what a planner notices, not counted facts – multi-valued and
 * independent of the type. Nothing that the data already measures belongs
 * here: steepness, length, altitude and a border crossing are numbers and stay
 * numbers. The order is the display order.
 */
export const ROAD_TAGS = [
  "panorama",
  "glacier",
  "gorge",
  "reservoir",
  "carfree",
  "toll",
  "hairpins",
  "cobbles",
  "tunnels",
] as const;

export type RoadTagName = (typeof ROAD_TAGS)[number];
export type TownTagName = (typeof TOWN_TAGS)[number];
/** A tag of either vocabulary; which one it belongs to is `tagLabel`'s question (`lib/i18n`). */
export type TagName = TownTagName | RoadTagName;

/**
 * What a road is rolled on (plan 27). One field that decides three things:
 * the routing profile (`profileOf`, `scripts/lib/validate.ts`), the closing rung of the
 * ladder – a barrier for asphalt, the snow cover for the rest
 * (`lib/status.ts`) – and the line the map draws it with. `mixed` is a road
 * with a gravel stretch a road bike cannot take, the Finestre; per-ascent
 * surfaces are not modelled, the note says which side. Road stays the
 * default: nothing a road cyclist sees changes unless the "Belag" chip is
 * pressed.
 */
export const SURFACES = ["asphalt", "gravel", "mixed"] as const;
export type SurfaceName = (typeof SURFACES)[number];

/**
 * The three statuses of the rideability heuristic, best first – the one list
 * the schema's enum, the filter, the map's icons, the share image and the
 * calibration script iterate (`lib/status.ts` reads the order as the rank).
 */
export const STATUSES = ["open", "risky", "closed"] as const;

/** Whether the road is ridden with something other than a road bike. */
export const isUnpaved = (surface: SurfaceName): boolean =>
  surface !== "asphalt";

/**
 * What a loop is ridden with, from its roads: gravel when every road is,
 * asphalt when every road is, mixed as soon as they differ or one is mixed.
 * `data:check` holds `Tour.surface` to this.
 */
export const surfaceOfRoads = (
  surfaces: readonly SurfaceName[],
): SurfaceName => {
  const set = new Set(surfaces);
  if (set.has("mixed") || set.size > 1) return "mixed";
  return set.has("gravel") ? "gravel" : "asphalt";
};
