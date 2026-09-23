import type { Messages } from "@/lib/i18n";
import { countriesOf, rangeOf } from "@/lib/regions";
import type { RangeName } from "@/lib/regions";
import type { Destination, Pass, Tour, Town } from "@/lib/types";

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

/**
 * The query folded once, as a test for any number of haystacks: a list asks
 * it of every row on every keystroke, and the query is the same for all.
 */
export const matcher = (query: string) => {
  const tokens = fold(query).split(" ");
  return (haystack: string) => tokens.every((t) => haystack.includes(t));
};

export const matches = (haystack: string, query: string) =>
  matcher(query)(haystack);

/** A country as its code and its name, so "frankreich" and "fr" both search. */
const countryWords = (country: string, w: Messages) =>
  countriesOf(country)
    .flatMap((c) => [c, w.vocab.country[c as keyof typeof w.vocab.country]])
    .join(" ");

const firstSentence = (s: string) => s.split(/(?<=[.!?])\s/u)[0] ?? s;

/**
 * A haystack is folded once per entity and language: the data never changes
 * at runtime, and the words it is searched in are the page's (plan 08) – the
 * vocabulary's own words join it, so "stich", "autofrei" and "gletscher" find
 * the entries that carry the label, and "glacier" does under `/en`.
 */
const perEntity = <K extends object>(
  build: (key: K, w: Messages) => string,
): ((key: K, w: Messages) => string) => {
  const byWords = new WeakMap<Messages, WeakMap<K, string>>();
  return (key, w) => {
    let hays = byWords.get(w);
    if (!hays) {
      hays = new WeakMap();
      byWords.set(w, hays);
    }
    let hay = hays.get(key);
    if (hay === undefined) {
      hay = build(key, w);
      hays.set(key, hay);
    }
    return hay;
  };
};

/** The range's word, which a town and an area append per keystroke. */
const rangeWord = (range: RangeName | undefined, w: Messages) =>
  range ? ` ${fold(w.vocab.range[range].label)}` : "";

export const passHaystack = perEntity<Pass>((pass, w) =>
  fold(
    [
      pass.name,
      ...(pass.aliases ?? []),
      w.vocab.region[pass.region],
      // "jura" and "vogesen" find their roads; "alpen" finds the rest.
      w.vocab.range[rangeOf(pass.region)].label,
      w.vocab.roadType[pass.type].label,
      ...(pass.tags ?? []).map((t) => w.vocab.roadTag[t].label),
      countryWords(pass.country, w),
      ...pass.ascents.map((a) => a.label),
      firstSentence(pass.note),
    ].join(" "),
  ),
);

/** Not cached: the haystack depends on the pass names handed in, and there are only a handful of tours. */
export const tourHaystack = (tour: Tour, passNames: string[]): string =>
  fold([tour.name, tour.description, tour.note, ...passNames].join(" "));

const townWords = perEntity<Town>((town, w) =>
  fold(
    [
      town.name,
      ...(town.aliases ?? []),
      countryWords(town.country, w),
      ...town.tags.map((t) => w.vocab.townTag[t].label),
      town.why,
    ].join(" "),
  ),
);

/**
 * A town carries no region; its range is what the server derived from the
 * roads in its reach (`townRanges`), so the word is handed in rather than
 * read off the town – and left out for a town beyond every road's reach.
 */
export const townHaystack = (
  town: Town,
  range: RangeName | undefined,
  w: Messages,
): string => townWords(town, w) + rangeWord(range, w);

/**
 * A destination is found by its name, its country and the towns one would
 * stay in; the prose is not searched – "Verkehr" would match half the areas.
 */
export const destinationHaystack = (
  d: Destination,
  baseTownNames: readonly string[],
  range: RangeName | undefined,
  w: Messages,
): string =>
  fold([d.name, countryWords(d.country, w), ...baseTownNames].join(" ")) +
  rangeWord(range, w);
