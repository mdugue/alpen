import type {
  RoadTagName,
  RoadTypeName,
  SurfaceName,
  TagName,
  TownTagName,
} from "@/lib/regions";

import type { Messages } from "./messages.de";

/**
 * What the client may import of the two languages: the vocabulary of the
 * languages themselves, the `Messages` type, `fill`, and three lookups over a
 * dictionary it is handed. No words: those arrive from the layout, one
 * language per page (`./dictionaries.ts` holds both, for the server).
 */
export type { Messages } from "./messages.de";
export { fill } from "./fill";
export type { Msg } from "./fill";
export * from "./lang";

/**
 * A tag's label, from whichever of the two vocabularies it belongs to – the
 * icon table, the badge and the popup draw a tag without caring which.
 */
export const tagLabel = (tag: TagName, w: Messages): string =>
  tag in w.vocab.townTag
    ? w.vocab.townTag[tag as TownTagName].label
    : w.vocab.roadTag[tag as RoadTagName].label;

/**
 * The type as a word where a list or a popup shows one, and nothing for a
 * `pass`: "Pass" on nine entries out of ten says nothing the list does not.
 */
export const typeWord = (
  type: RoadTypeName,
  w: Messages,
): string | undefined =>
  type === "pass" ? undefined : w.vocab.roadType[type].label;

/** The one word beside the type word in the panel and the popup; nothing for asphalt. */
export const surfaceWord = (
  surface: SurfaceName,
  w: Messages,
): string | null =>
  surface === "asphalt" ? null : w.vocab.surface[surface].label;
