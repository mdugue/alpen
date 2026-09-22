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
