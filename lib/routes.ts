import type { EntityKind, Selection } from "@/lib/app-state";

/**
 * The URL of an entity, and the entity of a URL (docs/plans/02-real-routes.md).
 *
 * Every pass, tour, town and destination has a path of its own – `/pass/x`,
 * `/tour/x`, `/ort/x`, `/ziel/x` – prerendered with its title and its share
 * image, while the camera, the half-month and the filters stay in the hash.
 * The segment is the German word the app uses for the kind where there is
 * one, so a link reads the way the tab does; `pass` and `tour` are the same
 * in both languages. Two functions, one table, so the pages, the sitemap and
 * the adapter cannot spell a path three ways.
 */
export const SEGMENT: Record<EntityKind, string> = {
  destination: "ziel",
  pass: "pass",
  tour: "tour",
  town: "ort",
};

const KIND_OF = new Map(
  (Object.entries(SEGMENT) as [EntityKind, string][]).map(([kind, seg]) => [
    seg,
    kind,
  ]),
);

/** The path of an entity, without the hash. */
export const hrefFor = (selection: Selection): string =>
  `/${SEGMENT[selection.kind]}/${encodeURIComponent(selection.slug)}`;

/**
 * The entity a path names, or `null` for the start page and for anything
 * that is not an entity path. The slug is not checked against the data here
 * – the pages are prerendered from it and a wrong one is a 404 – so the
 * reducer selects whatever a path says and the panel shows nothing for it.
 */
export const selectionOf = (pathname: string): Selection | null => {
  const [seg, slug, rest] = pathname.replace(/^\//u, "").split("/");
  if (!seg || !slug || rest !== undefined) return null;
  const kind = KIND_OF.get(seg);
  return kind ? { kind, slug: decodeURIComponent(slug) } : null;
};

/**
 * A hash from before the routes, with the selection it used to carry taken
 * out: `#pass=x&t=6` becomes `#t=6`, for the path that now carries the pass.
 */
export const withoutLegacySelection = (hash: string): string => {
  const params = new URLSearchParams(hash.replace(/^#/u, ""));
  for (const key of Object.values(SEGMENT)) params.delete(key);
  // The old key for a town was `town`, before the German segment.
  params.delete("town");
  const rest = params.toString();
  return rest ? `#${rest}` : "";
};
