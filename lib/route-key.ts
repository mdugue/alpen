import type { EntityKind, Selection } from "./app-state";

/**
 * The keys of `data/generated/routes.json` (and of the profiles, metadata and
 * rejections that follow it): one per ascent, one per tour. Built here so the
 * map assets, the nearby computation and the panel cannot drift apart on a
 * string literal.
 *
 * This is also where `entityKey` lives rather than beside the state that uses
 * it, and why the module imports nothing that survives compilation: the detail
 * assets are keyed by it, and `next.config.ts` loads `lib/detail-assets.ts`
 * outside the bundler, where a module reaching the "@/" alias cannot be
 * followed. The two types below are erased, so nothing is resolved at run
 * time.
 */
export const ascentKey = (passSlug: string, index: number) =>
  `${passSlug}:${index}`;

export const tourKey = (tourSlug: string) => `tour:${tourSlug}`;

/** What a route key says it is: one ride of a road, or a tour. */
export type RouteKey =
  | { index: number; kind: "ascent"; slug: string }
  | { kind: "tour"; slug: string };

const TOUR_PREFIX = "tour:";

/**
 * The inverse of `ascentKey` and `tourKey`, for the places that read a key
 * back rather than write one: a rejection, an orphaned entry in a generated
 * file, a line of `data:check`. `null` for anything neither function could
 * have produced – a generated file may carry a key from a pass that has since
 * been renamed, and guessing at it would be worse than saying so.
 *
 * Spelling a key by hand is how the two sides drift: before this existed, the
 * test for the tour prefix stood in three files and each decided for itself
 * what the rest of the string meant.
 */
export const parseRouteKey = (key: string): RouteKey | null => {
  if (key.startsWith(TOUR_PREFIX)) {
    const slug = key.slice(TOUR_PREFIX.length);
    return slug ? { kind: "tour", slug } : null;
  }
  const cut = key.lastIndexOf(":");
  const tail = key.slice(cut + 1);
  return cut > 0 && /^\d+$/u.test(tail)
    ? { index: Number(tail), kind: "ascent", slug: key.slice(0, cut) }
    : null;
};

/**
 * The kind and the slug, joined by a colon – the one spelling of an entity's
 * identity. It keys `photos.json`, `nearbyTours`, the detail assets, the rows'
 * `data-row`, the map's feature state and the panel's remount, so it is
 * written here once.
 */
interface EntityKeyFn {
  (selection: Selection): string;
  (kind: EntityKind, slug: string): string;
}
export const entityKey: EntityKeyFn = (
  sel: Selection | EntityKind,
  slug?: string,
) => (typeof sel === "string" ? `${sel}:${slug}` : `${sel.kind}:${sel.slug}`);
