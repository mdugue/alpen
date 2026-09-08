import { COUNTRY_NAME, countriesOf } from "@/lib/regions";
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

export function passHaystack(pass: Pass): string {
  let hay = passHay.get(pass);
  if (hay === undefined) {
    hay = fold(
      [
        pass.name,
        ...(pass.aliases ?? []),
        pass.region,
        countryWords(pass.country),
        ...pass.ascents.map((a) => a.label),
        firstSentence(pass.note),
      ].join(" "),
    );
    passHay.set(pass, hay);
  }
  return hay;
}

/** Not cached: the haystack depends on the pass names handed in, and there are only a handful of tours. */
export function tourHaystack(tour: Tour, passNames: string[]): string {
  return fold([tour.name, tour.description, ...passNames].join(" "));
}

export function townHaystack(town: Town): string {
  let hay = townHay.get(town);
  if (hay === undefined) {
    hay = fold([town.name, countryWords(town.country), town.why].join(" "));
    townHay.set(town, hay);
  }
  return hay;
}
