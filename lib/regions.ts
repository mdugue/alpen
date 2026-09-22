/**
 * The fixed vocabularies of the data: regions and countries. Shared by the
 * schema (server), the filters (client) and the search haystacks – this
 * module must stay free of zod so it can reach the client bundle.
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
 * Label, hint, and the range in a sentence: German declines the article, and
 * three of the four are plural where the Jura is not – "in den Alpen" but
 * "im Jura", "außerhalb der Vogesen" but "außerhalb des Juras" – so the
 * phrases are written per range rather than glued to the label.
 */
export const RANGE: Record<
  RangeName,
  { label: string; hint: string; inside: string; outside: string }
> = {
  Alpen: {
    hint: "Von den Seealpen bis nach Slowenien – Westalpen, Zentralalpen, Ostalpen und Dolomiten.",
    inside: "in den Alpen",
    label: "Alpen",
    outside: "außerhalb der Alpen",
  },
  Jura: {
    hint: "Grand Colombier, Mont du Chat, Faucille, Chasseral: lange Saison, wenig Verkehr, zwei Stunden ab Basel.",
    inside: "im Jura",
    label: "Jura",
    outside: "außerhalb des Juras",
  },
  Pyrenäen: {
    hint: "Tourmalet, Aubisque, Peyresourde, Ariège und Andorra: die anderen Berge der Tour, mit der langen Saison der spanischen Seite.",
    inside: "in den Pyrenäen",
    label: "Pyrenäen",
    outside: "außerhalb der Pyrenäen",
  },
  Vogesen: {
    hint: "Grand Ballon, Schlucht, Ballon d'Alsace und die Route des Crêtes: das Wochenende ab Freiburg, Basel oder Karlsruhe.",
    inside: "in den Vogesen",
    label: "Vogesen",
    outside: "außerhalb der Vogesen",
  },
};

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

/** German names for the country codes, so "frankreich" and "fr" both search. */
export const COUNTRY_NAME: Record<(typeof COUNTRIES)[number], string> = {
  AD: "Andorra",
  AT: "Österreich",
  CH: "Schweiz",
  DE: "Deutschland",
  ES: "Spanien",
  FR: "Frankreich",
  IT: "Italien",
  SI: "Slowenien",
};

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

export const TOWN_TAG: Record<
  (typeof TOWN_TAGS)[number],
  { label: string; hint: string }
> = {
  events: {
    hint: "Start oder Zentrum eines großen Radmarathons.",
    label: "Marathon-Ort",
  },
  hotels: {
    hint: "Unterkünfte mit Radkeller, Waschplatz und Tourenservice.",
    label: "Bike-Hotels",
  },
  hub: {
    hint: "Fester Begriff im Rennradkalender: im Sommer voller Rennräder, Servicepoints, Trainingsziel.",
    label: "Radsport-Mekka",
  },
  passes: {
    hint: "Mehrere klassische Anstiege beginnen ohne Anfahrt vor der Haustür.",
    label: "Pässe vor der Tür",
  },
  quiet: {
    hint: "Wenig Durchgangsverkehr: Nebental statt Transitachse.",
    label: "Ruhig",
  },
  scenic: {
    hint: "Lage und Landschaft sind selbst ein Grund, hierher zu fahren.",
    label: "Besonders schön",
  },
  season: {
    hint: "Tief und mild gelegen – fährt sich früh im Jahr und noch spät im Herbst.",
    label: "Lange Saison",
  },
  train: {
    hint: "Ohne Auto erreichbar: Bahnhof im Ort oder im Tal darunter.",
    label: "Bahnanschluss",
  },
  workshops: {
    hint: "Rennradläden mit Werkstatt und Leihrädern am Ort.",
    label: "Werkstätten & Verleih",
  },
};

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

export const ROAD_TYPE: Record<RoadTypeName, { label: string; hint: string }> =
  {
    balcony: {
      hint: "In eine Wand gehauen, ohne Gipfel, auf den die Fahrt zuläuft: Combe Laval, Gorges de la Bourne.",
      label: "Balkonstraße",
    },
    pass: {
      hint: "Ein Übergang: auf der einen Seite hinauf, auf der anderen hinunter.",
      label: "Pass",
    },
    plateau: {
      hint: "Bleibt oben, statt einmal überzuqueren: Höhenstraße, Hochebene.",
      label: "Höhenstraße",
    },
    spur: {
      hint: "Ein Anstieg zu einem Punkt, an dem die Straße endet – hinunter geht es dieselbe Auffahrt zurück.",
      label: "Stichstraße",
    },
    valley: {
      hint: "Ein ruhiges Sackgassental mit wenig Steigung.",
      label: "Talstraße",
    },
  };

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
 * `TOWN_TAG` – what a planner notices, not counted facts – multi-valued and
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

export const ROAD_TAG: Record<RoadTagName, { label: string; hint: string }> = {
  carfree: {
    hint: "Für Autos gesperrt, mindestens an festen Tagen – wann, steht in der Notiz.",
    label: "Autofrei",
  },
  cobbles: {
    hint: "Ein Stück ist gepflastert – Tremola, Vršič –, das ändert die Reifenwahl, nicht das Rad.",
    label: "Pflaster",
  },
  glacier: {
    hint: "Endet an einem Gletscher oder führt an ihm entlang.",
    label: "Gletscherstraße",
  },
  gorge: {
    hint: "Ein nennenswertes Stück führt durch eine Schlucht oder einen Canyon.",
    label: "Schlucht",
  },
  hairpins: {
    hint: "Das Kehrenbauwerk ist selbst ein Denkmal – Tremola, Lacets de Montvernier, San Boldo.",
    label: "Kehrenbauwerk",
  },
  panorama: {
    hint: "Für die Aussicht gebaut, und Name oder Streckenführung sagen das auch.",
    label: "Panoramastraße",
  },
  reservoir: {
    hint: "Die Straße gibt es wegen einer Staumauer; sie endet am See oder führt an ihm entlang.",
    label: "Stausee",
  },
  toll: {
    hint: "Mautstraße; ob Räder zahlen, steht in der Notiz. Unabhängig davon, ob sie geräumt wird.",
    label: "Maut",
  },
  tunnels: {
    hint: "Unbeleuchtete Tunnel oder Galerien, mit denen zu rechnen ist.",
    label: "Tunnel & Galerien",
  },
};

/**
 * Both label vocabularies under one roof, for the three places that draw a tag
 * without caring which list it came from: the icon table, the badge and the
 * map's popup. The two vocabularies share no name; `lib/tag-icons.test.ts`
 * fails if they ever did.
 */
export const TAG_LABEL: Record<TagName, { label: string; hint: string }> = {
  ...TOWN_TAG,
  ...ROAD_TAG,
};

/**
 * What a road is rolled on (plan 27). One field that decides three things:
 * the routing profile (`scripts/lib/pipeline.ts`), the closing rung of the
 * ladder – a barrier for asphalt, the snow cover for the rest
 * (`lib/status.ts`) – and the line the map draws it with. `mixed` is a road
 * with a gravel stretch a road bike cannot take, the Finestre; per-ascent
 * surfaces are not modelled, the note says which side. Road stays the
 * default: nothing a road cyclist sees changes unless the "Belag" chip is
 * pressed.
 */
export const SURFACES = ["asphalt", "gravel", "mixed"] as const;
export type SurfaceName = (typeof SURFACES)[number];

export const SURFACE: Record<SurfaceName, { label: string; hint: string }> = {
  asphalt: {
    hint: "Durchgehend asphaltiert – die Straße, die ein Rennrad fährt.",
    label: "Asphalt",
  },
  gravel: {
    hint: "Ungeteert – Schotter, Militärstraße, Almweg: Gravel- oder Mountainbike, und offen, sobald der Schnee weg ist.",
    label: "Schotter",
  },
  mixed: {
    hint: "Asphalt mit einem Schotterstück, das kein Rennrad fährt – die Notiz sagt, wo.",
    label: "Gemischt",
  },
};

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
