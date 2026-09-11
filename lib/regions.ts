/**
 * The fixed vocabularies of the data: regions and countries. Shared by the
 * schema (server), the filters (client) and the search haystacks – this
 * module must stay free of zod so it can reach the client bundle.
 */
export const REGIONS = [
  "Westalpen",
  "Zentralalpen",
  "Ostalpen",
  "Dolomiten",
] as const;

export const COUNTRIES = ["FR", "IT", "CH", "AT", "DE", "SI"] as const;

/** German names for the country codes, so "frankreich" and "fr" both search. */
export const COUNTRY_NAME: Record<(typeof COUNTRIES)[number], string> = {
  AT: "Österreich",
  CH: "Schweiz",
  DE: "Deutschland",
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
  "surface",
  "tunnels",
] as const;

export type RoadTagName = (typeof ROAD_TAGS)[number];

export const ROAD_TAG: Record<RoadTagName, { label: string; hint: string }> = {
  carfree: {
    hint: "Für Autos gesperrt, mindestens an festen Tagen – wann, steht in der Notiz.",
    label: "Autofrei",
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
  surface: {
    hint: "Ein Stück ist kein glatter Asphalt – Pflaster oder Schotterdecke –, das ändert die Reifenwahl.",
    label: "Pflaster oder Schotter",
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
 * map's popup. The two vocabularies share no name, and `data:check` would say
 * so if they ever did.
 */
export const TAG_LABEL: Record<
  (typeof TOWN_TAGS)[number] | RoadTagName,
  { label: string; hint: string }
> = { ...TOWN_TAG, ...ROAD_TAG };
