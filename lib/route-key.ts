import type { EntityKind, Selection } from "./app-state";

/**
 * The keys of `data/generated/routes.json` (and of the profiles, metadata and
 * rejections that follow it): one per ascent, one per tour. Built here so the
 * map assets, the nearby computation and the panel cannot drift apart on a
 * string literal. Client-safe and free of imports: `next.config.ts` loads
 * `lib/detail-assets.ts` outside the bundler, where nothing that reaches the
 * "@/" alias can be followed, which is why the entity key lives here rather
 * than beside the state that uses it.
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
