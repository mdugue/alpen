import type {
  RoadTagName,
  RoadTypeName,
  SurfaceName,
  TagName,
  TownTagName,
} from "@/lib/regions";

import { DEFAULT_LANG } from "./lang";
import type { Lang } from "./lang";
import { de } from "./messages.de";
import type { Messages } from "./messages.de";
import { en } from "./messages.en";

export type { Messages } from "./messages.de";
export * from "./lang";

const MESSAGES: Record<Lang, Messages> = { de, en };

/** The words of one language; the German file is the shape both are held to. */
export const messagesOf = (lang: Lang): Messages => MESSAGES[lang];

/** The vocabulary of one language: ranges, tags, road types, surfaces, bands. */
export const vocabOf = (lang: Lang = DEFAULT_LANG) => MESSAGES[lang].vocab;

/**
 * A tag's label in the page's language, from whichever of the two
 * vocabularies it belongs to – the icon table, the badge and the popup draw a
 * tag without caring which.
 */
export const tagLabel = (tag: TagName, lang: Lang = DEFAULT_LANG): string => {
  const v = vocabOf(lang);
  return tag in v.townTag
    ? v.townTag[tag as TownTagName].label
    : v.roadTag[tag as RoadTagName].label;
};

/**
 * The type as a word where a list or a popup shows one, and nothing for a
 * `pass`: "Pass" on nine entries out of ten says nothing the list does not.
 */
export const typeWord = (
  type: RoadTypeName,
  lang: Lang = DEFAULT_LANG,
): string | undefined =>
  type === "pass" ? undefined : vocabOf(lang).roadType[type].label;

/** The one word beside the type word in the panel and the popup; nothing for asphalt. */
export const surfaceWord = (
  surface: SurfaceName,
  lang: Lang = DEFAULT_LANG,
): string | null =>
  surface === "asphalt" ? null : vocabOf(lang).surface[surface].label;
