import {
  COUNTRY_NAME,
  countriesOf,
  RANGE,
  rangeOf,
  ROAD_TAG,
  ROAD_TYPE,
  TOWN_TAG,
} from "@/lib/regions";
import type { RangeName } from "@/lib/regions";
import type { Pass, Tour, Town } from "@/lib/types";

/**
 * Search the way people spell things: "grossglockner" finds "Großglockner",
 * "vrsic" finds "Vršič", "stilfser" finds Passo dello Stelvio via its alias.
 * `fold` strips accents and punctuation from both sides; every query token
 * has to occur somewhere in the entity's haystack.
 */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/\p{M}+/gu, "")
    .replaceAll("ß", "ss")
    .replaceAll("æ", "ae")
    .replaceAll("œ", "oe")
    .replaceAll("ł", "l")
    // Apostrophes join ("l'Iseran" → "liseran"), everything else separates.
    .replaceAll(/['’]/gu, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const matches = (haystack: string, query: string) =>
  fold(query)
    .split(" ")
    .every((token) => haystack.includes(token));

const countryWords = (country: string) =>
  countriesOf(country)
    .flatMap((c) => [c, COUNTRY_NAME[c as keyof typeof COUNTRY_NAME] ?? ""])
    .join(" ");

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/u)[0] ?? s;

// Haystacks are folded once per entity object; the data never changes at runtime.
const passHay = new WeakMap<Pass, string>();
const townHay = new WeakMap<Town, string>();
/** The range labels folded once: a town's haystack appends one per keystroke. */
const RANGE_WORD = Object.fromEntries(
  Object.entries(RANGE).map(([k, v]) => [k, fold(v.label)]),
) as Record<RangeName, string>;

export const passHaystack = (pass: Pass): string => {
  let hay = passHay.get(pass);
  if (hay === undefined) {
    hay = fold(
      [
        pass.name,
        ...(pass.aliases ?? []),
        pass.region,
        // "jura" and "vogesen" find their roads; "alpen" finds the rest.
        RANGE[rangeOf(pass.region)].label,
        // "stich", "autofrei" and "gletscher" have to find the entries that
        // carry the label, so the vocabulary's own words join the haystack.
        ROAD_TYPE[pass.type].label,
        ...(pass.tags ?? []).map((t) => ROAD_TAG[t].label),
        countryWords(pass.country),
        ...pass.ascents.map((a) => a.label),
        firstSentence(pass.note),
      ].join(" "),
    );
    passHay.set(pass, hay);
  }
  return hay;
};

/** Not cached: the haystack depends on the pass names handed in, and there are only a handful of tours. */
export const tourHaystack = (tour: Tour, passNames: string[]): string =>
  fold([tour.name, tour.description, tour.note, ...passNames].join(" "));

/**
 * A town carries no region; its range is what the server derived from the
 * roads in its reach (`townRanges`), so the word is handed in rather than
 * read off the town – and left out for a town beyond every road's reach.
 */
export const townHaystack = (town: Town, range?: RangeName): string => {
  let hay = townHay.get(town);
  if (hay === undefined) {
    hay = fold(
      [
        town.name,
        ...(town.aliases ?? []),
        countryWords(town.country),
        ...town.tags.map((t) => TOWN_TAG[t].label),
        town.why,
      ].join(" "),
    );
    townHay.set(town, hay);
  }
  return range ? `${hay} ${RANGE_WORD[range]}` : hay;
};
