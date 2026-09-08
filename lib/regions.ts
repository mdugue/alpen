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
  FR: "Frankreich",
  IT: "Italien",
  CH: "Schweiz",
  AT: "Österreich",
  DE: "Deutschland",
  SI: "Slowenien",
};

/** "CH/IT" → ["CH", "IT"]. */
export const countriesOf = (country: string) => country.split("/");
