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
