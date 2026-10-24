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
export const RANGES = [
  "Alpen",
  "Vogesen",
  "Jura",
  "Pyrenäen",
  "Erzgebirge",
  "Schwarzwald",
  "Mallorca",
  "Zentralmassiv",
  "Harz",
  "Thüringen",
  "Bayerwald",
  "Korsika",
  "Kanaren",
  "Nordspanien",
  "Andalusien",
  "Apennin",
  "Sizilien",
  "Ardennen",
  "Riesengebirge",
  "Tatra",
] as const;

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
 * Which regions each range holds. Every range but the Alps is one region
 * until the data asks for a split; the Alps keep their four.
 */
export const RANGE_REGIONS = {
  Alpen: ["Westalpen", "Zentralalpen", "Ostalpen", "Dolomiten"],
  Andalusien: ["Sierra Nevada", "Almería"],
  Apennin: ["Abruzzen", "Latium", "Toskana", "Marken"],
  Ardennen: ["Ardennen"],
  Bayerwald: ["Bayerwald", "Böhmerwald"],
  Erzgebirge: ["Erzgebirge"],
  Harz: ["Harz"],
  Jura: ["Jura"],
  Kanaren: ["Teneriffa", "Gran Canaria", "La Palma"],
  Korsika: ["Korsika"],
  Mallorca: ["Mallorca"],
  Nordspanien: ["Asturien", "Kantabrien"],
  Pyrenäen: ["Pyrenäen"],
  Riesengebirge: ["Riesengebirge", "Jeschken und Isergebirge"],
  Schwarzwald: ["Schwarzwald"],
  Sizilien: ["Ätna", "Nordsizilien", "Westsizilien"],
  Tatra: ["Hohe Tatra", "Podhale", "Niedere Tatra"],
  Thüringen: ["Thüringen", "Rhön"],
  Vogesen: ["Vogesen"],
  Zentralmassiv: ["Zentralmassiv"],
} as const satisfies Record<RangeName, readonly string[]>;

/**
 * How a range is travelled to: for a weekend from home, or for a holiday
 * week. A property of the range, not a filter – it sorts the range chips
 * into two rows so that a score of them stays readable
 * (docs/plans/34-beyond-the-alps.md). The order is the display order.
 */
export const TRIPS = ["holiday", "weekend"] as const;
export type TripName = (typeof TRIPS)[number];

export const RANGE_TRIP: Record<RangeName, TripName> = {
  Alpen: "holiday",
  Andalusien: "holiday",
  Apennin: "holiday",
  Ardennen: "weekend",
  Bayerwald: "weekend",
  Erzgebirge: "weekend",
  Harz: "weekend",
  Jura: "weekend",
  Kanaren: "holiday",
  Korsika: "holiday",
  Mallorca: "holiday",
  Nordspanien: "holiday",
  Pyrenäen: "holiday",
  Riesengebirge: "weekend",
  Schwarzwald: "weekend",
  Sizilien: "holiday",
  Tatra: "holiday",
  Thüringen: "weekend",
  Vogesen: "weekend",
  Zentralmassiv: "holiday",
};

/**
 * The range chips as rows: one row per trip once both rows hold a choice of
 * two or more, otherwise one row with the holiday ranges first. A row of one
 * chip under its own label would read as a filter of its own.
 */
export const rangeRows = (
  ranges: readonly RangeName[],
): { trip: TripName | null; row: RangeName[] }[] => {
  const rows = TRIPS.map((trip) => ({
    row: ranges.filter((r) => RANGE_TRIP[r] === trip),
    trip,
  })).filter(({ row }) => row.length > 0);
  return rows.length > 1 && rows.every(({ row }) => row.length > 1)
    ? rows
    : [{ row: rows.flatMap(({ row }) => row), trip: null }];
};

/** The flat union, in range order – what the schema's `Region` enum is made of. */
export const REGIONS = [
  ...RANGE_REGIONS.Alpen,
  ...RANGE_REGIONS.Vogesen,
  ...RANGE_REGIONS.Jura,
  ...RANGE_REGIONS.Pyrenäen,
  ...RANGE_REGIONS.Erzgebirge,
  ...RANGE_REGIONS.Schwarzwald,
  ...RANGE_REGIONS.Mallorca,
  ...RANGE_REGIONS.Zentralmassiv,
  ...RANGE_REGIONS.Harz,
  ...RANGE_REGIONS.Thüringen,
  ...RANGE_REGIONS.Bayerwald,
  ...RANGE_REGIONS.Korsika,
  ...RANGE_REGIONS.Kanaren,
  ...RANGE_REGIONS.Nordspanien,
  ...RANGE_REGIONS.Andalusien,
  ...RANGE_REGIONS.Apennin,
  ...RANGE_REGIONS.Sizilien,
  ...RANGE_REGIONS.Ardennen,
  ...RANGE_REGIONS.Riesengebirge,
  ...RANGE_REGIONS.Tatra,
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
 * Neighbouring boxes overlap – the Vosges, the Jura and the Black Forest lie
 * inside the Alps' box, the Black Forest's touches the Vosges' – so the guard
 * catches a road filed hundreds of kilometres off (the Pyrenees, Mallorca,
 * the Ore Mountains) and a coordinate typed into the sea, not a Black Forest
 * road filed as "Vogesen". That one is the curator's to read off the map.
 */
export const RANGE_BOUNDS: Record<RangeName, GeoBox> = {
  Alpen: { lat: [43, 49], lon: [4, 16] },
  Andalusien: { lat: [36.6, 37.6], lon: [-4, -2] },
  Apennin: { lat: [41.8, 44.6], lon: [9.8, 14.6] },
  Ardennen: { lat: [50.2, 50.8], lon: [5.1, 6.3] },
  Bayerwald: { lat: [48.6, 49.4], lon: [12.5, 14.5] },
  Erzgebirge: { lat: [50.2, 51], lon: [12.2, 14.2] },
  Harz: { lat: [51.4, 52.1], lon: [10.1, 11.4] },
  Jura: { lat: [45, 48], lon: [5, 8] },
  Kanaren: { lat: [27.5, 29.5], lon: [-18.3, -13.3] },
  Korsika: { lat: [41.3, 43.1], lon: [8.5, 9.6] },
  Mallorca: { lat: [39.2, 40.1], lon: [2.2, 3.6] },
  Nordspanien: { lat: [42.6, 43.7], lon: [-7.3, -3] },
  Pyrenäen: { lat: [42, 43.5], lon: [-2, 3.5] },
  Riesengebirge: { lat: [50.55, 50.9], lon: [14.9, 15.95] },
  Schwarzwald: { lat: [47.5, 49], lon: [7.5, 9] },
  Sizilien: { lat: [36.6, 38.4], lon: [12.3, 15.7] },
  Tatra: { lat: [48.75, 49.5], lon: [19.4, 20.5] },
  Thüringen: { lat: [50.2, 51], lon: [9.6, 11.4] },
  Vogesen: { lat: [47, 49], lon: [6, 8] },
  Zentralmassiv: { lat: [43.8, 46.2], lon: [2, 4.3] },
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
  "LI",
  "CZ",
  "BE",
  "PL",
  "SK",
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
 * point it is a `pass`, a `spur` or a `climb` and is measured as a climb; if
 * the ride is the traverse itself it is one of the other three and is measured
 * the way a tour is. A `climb` (a "Steige") is the low ranges' commonest kind:
 * a through road that gains the edge of a plateau or a ridge and carries on up
 * there, so its top is neither a saddle nor a dead end
 * (docs/plans/34-beyond-the-alps.md). The order is the display order in the
 * filter and the scales dialog.
 */
export const ROAD_TYPES = [
  "pass",
  "spur",
  "climb",
  "plateau",
  "balcony",
  "valley",
] as const;

export type RoadTypeName = (typeof ROAD_TYPES)[number];

/**
 * Where a classic starts on the editorial fame scale (1–5): what the
 * "Klassiker" chip keeps, what the app opens on, and the roads the label
 * ladder never moves (`rankOf`, lib/prominence.ts).
 */
export const CLASSIC_FAME = 4;

/** The top of the beauty scale: a pearl, its name one step earlier on the map. */
export const PEARL_BEAUTY = 5;

/**
 * What kind of ride a tour is: how one goes about riding it, not what its
 * roads are like. Single-valued, because the question it answers is "can I
 * just go" – a loop any day, an event course whose roads close for one day a
 * year and are free the rest of it, a signposted permanent route with a stamp
 * card and a medal, a route over several days from A to B with nights on
 * the way, or one year's course of an event that changes it every year (an
 * `edition`, which carries its `series` and `year`). The order is the display
 * order in the chips and the scales dialog.
 */
export const TOUR_TYPES = [
  "loop",
  "event",
  "edition",
  "permanent",
  "stages",
] as const;

/** The kinds of tour that happen on one day a year and carry its `when`. */
export const DATED_TOUR_TYPES = [
  "event",
  "edition",
] as const satisfies readonly (typeof TOUR_TYPES)[number][];

export type TourTypeName = (typeof TOUR_TYPES)[number];

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
  "forest",
  "carfree",
  "toll",
  "hairpins",
  "cobbles",
  "tunnels",
  "race",
] as const;

export type RoadTagName = (typeof ROAD_TAGS)[number];

/**
 * Which way a side of a crossing is better ridden: up, down, or either. An
 * editorial judgement like the 1–5 scales, written per ascent in
 * `data/portraits.json` and only where there is a choice – a `pass` or `spur`
 * with two sides or more, never a `climb`, whose sides both end at a
 * plateau's edge (`data:check` holds it to that).
 */
export const BEST_AS = ["up", "down", "both"] as const;
export type BestAsName = (typeof BEST_AS)[number];

/**
 * What to watch on the way down a side, as a small editorial vocabulary in
 * the sense of `ROAD_TAGS`: what a rider braces for, not what is measured.
 * The display order is the vocabulary order.
 */
export const DESCENT_HAZARDS = [
  "tight-hairpins",
  "tunnels",
  "steep",
  "rough",
  "gravel",
  "narrow",
  "grids",
  "traffic",
] as const;
export type DescentHazardName = (typeof DESCENT_HAZARDS)[number];

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
