/**
 * The keys of `data/generated/routes.json` (and of the profiles, metadata and
 * rejections that follow it): one per ascent, one per tour. Built here so the
 * map assets, the nearby computation and the panel cannot drift apart on a
 * string literal. Client-safe: no dependencies.
 */
export const ascentKey = (passSlug: string, index: number) =>
  `${passSlug}:${index}`;

export const tourKey = (tourSlug: string) => `tour:${tourSlug}`;
