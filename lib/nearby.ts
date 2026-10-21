import { bounds, haversine, paddedHull, REACH_MAX_KM } from "@/lib/geo";
import type { Ring } from "@/lib/geo";
import { inBox, rangeOf } from "@/lib/regions";
import type { GeoBox, RangeName } from "@/lib/regions";
import { entityKey, tourKey } from "@/lib/route-key";
import type { LatLon, Pass, RouteGeometry, Tour, Town } from "@/lib/types";

/** One tour within reach of an entity, as the server measured it. */
export interface NearbyTour {
  slug: string;
  /**
   * Kilometres from the entity to the nearest point of the tour's road. A
   * tour is a line, so this is the only distance it has – and it is what lets
   * `lib/reach.ts` band and rank a tour the way it bands a pass, instead of
   * leaving the one kind of neighbour without a place in the vocabulary.
   */
  km: number;
}

/**
 * Which tours pass within `REACH_MAX_KM` of each entity, precomputed on
 * the server so the detail panel's "Im Umkreis" list needs no tour geometry
 * on the client (docs/plans/01-map-data-out-of-payload.md). Passes and towns
 * nearby are still measured in the panel: those are points, and a hundred
 * haversines are nothing – it is the walk along 60 000 route coordinates
 * that had to go.
 *
 * Key: `entityKey` (a tour is measured from its first waypoint, as the panel
 * does); value: the tours in `tours.json` order, ranked afterwards by whoever
 * reads them.
 */
export type NearbyTours = Record<string, NearbyTour[]>;

/** A tour without a routed geometry is judged by its waypoints, as before. */
const tourLine = (
  tour: Tour,
  routes: Record<string, RouteGeometry>,
): RouteGeometry =>
  routes[tourKey(tour.slug)] ?? tour.waypoints.map((w) => [w.lat, w.lon]);

/**
 * How near the road comes, in km – `Infinity` for an empty line. A loop
 * rather than `Math.min(...)`: a routed tour is thousands of coordinates, and
 * that many spread arguments is what a call stack is not for.
 */
const distanceTo = (line: RouteGeometry, at: LatLon) => {
  let min = Number.POSITIVE_INFINITY;
  for (const [lat, lon] of line)
    min = Math.min(min, haversine(at, { lat, lon }));
  return min;
};

/**
 * A line's bounding box grown by `km` on every side. Generous rather than
 * exact: a point outside it is farther than `km` from every point of the line,
 * so the box only ever skips what the walk would have filtered out. The
 * longitude margin is taken at the box's poleward edge, where a degree is
 * shortest.
 */
const reachBox = (line: RouteGeometry, km: number): GeoBox | null => {
  if (line.length === 0) return null;
  const [w, s, e, n] = bounds(line);
  const dLat = km / 110;
  const edge = Math.min(89, Math.max(Math.abs(s), Math.abs(n)) + dLat);
  const dLon = km / (111.32 * Math.cos((edge * Math.PI) / 180));
  return { lat: [s - dLat, n + dLat], lon: [w - dLon, e + dLon] };
};

export const nearbyTours = (
  passes: readonly Pass[],
  tours: readonly Tour[],
  towns: readonly Town[],
  routes: Record<string, RouteGeometry>,
  radiusKm = REACH_MAX_KM,
): NearbyTours => {
  const lines = tours.map((t) => {
    const line = tourLine(t, routes);
    return { box: reachBox(line, radiusKm), line, slug: t.slug };
  });
  const near = (at: LatLon): NearbyTour[] =>
    lines
      // Most entities lie nowhere near most tours; the box rules those out
      // before the walk along the road, which is what made this cost seconds.
      .filter(({ box }) => box !== null && inBox(box, at))
      .map(({ line, slug }) => ({ km: distanceTo(line, at), slug }))
      // One decimal is as fine as a reach band can read, and the value travels
      // to every client as part of the page.
      .filter((t) => t.km <= radiusKm)
      .map((t) => ({ km: +t.km.toFixed(1), slug: t.slug }));
  const out: NearbyTours = {};
  for (const p of passes) out[entityKey("pass", p.slug)] = near(p);
  for (const t of tours) out[entityKey("tour", t.slug)] = near(t.waypoints[0]!);
  for (const t of towns) out[entityKey("town", t.slug)] = near(t);
  return out;
};

/**
 * The area a town reaches: the padded hull of the town and every pass within
 * `radiusKm` (`paddedHull`). Precomputed on the server for the same reason as
 * the tours above – the map hovers it, and a hull per town is a few hundred
 * bytes against the alternative of shipping the logic and recomputing it on
 * every pointer move.
 *
 * Key: town slug. A town with fewer than two passes around it reaches no
 * area worth drawing and is left out.
 */
export type TownReach = Record<string, Ring>;

/** How far the hull reaches past the points it is drawn around, in km. */
const REACH_PADDING_KM = 4;

export const townReach = (
  passes: readonly Pass[],
  towns: readonly Town[],
  radiusKm = REACH_MAX_KM,
): TownReach => {
  const out: TownReach = {};
  for (const town of towns) {
    const points = passes.filter((p) => haversine(town, p) <= radiusKm);
    if (points.length >= 2)
      out[town.slug] = paddedHull([town, ...points], REACH_PADDING_KM);
  }
  return out;
};

/**
 * The range a town belongs to: that of the nearest road within `radiusKm`.
 * A town carries no region of its own – it is a base, and a base is chosen for
 * what it reaches – so the nearest road decides. Beyond every road's reach a
 * town has no range and is left out; the range chip then never hides it.
 */
export const townRanges = (
  passes: readonly Pass[],
  towns: readonly Town[],
  radiusKm = REACH_MAX_KM,
): Partial<Record<string, RangeName>> => {
  const out: Partial<Record<string, RangeName>> = {};
  for (const town of towns) {
    let nearest: { km: number; range: RangeName } | null = null;
    for (const p of passes) {
      const km = haversine(town, p);
      if (km <= radiusKm && (!nearest || km < nearest.km))
        nearest = { km, range: rangeOf(p.region) };
    }
    if (nearest) out[town.slug] = nearest.range;
  }
  return out;
};
