import { convexHull, expandRing, haversine, NEARBY_RADIUS_KM } from "@/lib/geo";
import { rangeOf } from "@/lib/regions";
import type { RangeName } from "@/lib/regions";
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
 * Which tours pass within `NEARBY_RADIUS_KM` of each entity, precomputed on
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

export const nearbyTours = (
  passes: readonly Pass[],
  tours: readonly Tour[],
  towns: readonly Town[],
  routes: Record<string, RouteGeometry>,
  radiusKm = NEARBY_RADIUS_KM,
): NearbyTours => {
  const lines = tours.map((t) => [t.slug, tourLine(t, routes)] as const);
  const near = (at: LatLon): NearbyTour[] =>
    lines
      .map(([slug, line]) => ({ km: distanceTo(line, at), slug }))
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
 * The area a town reaches: the convex hull of the town and every pass within
 * `radiusKm`, expanded a little so it reads as a region rather than a polygon
 * cutting through the pass dots. Precomputed on the server for the same
 * reason as the tours above – the map hovers it, and a hull per town is a few
 * hundred bytes against the alternative of shipping the logic and recomputing
 * it on every pointer move.
 *
 * Key: town slug; value: a ring as `[lon, lat]` pairs, ready as a GeoJSON
 * polygon and open (MapLibre closes it). A town with fewer than three points
 * has no hull and is left out.
 */
export type TownReach = Record<string, [number, number][]>;

/** How far the hull is pushed out from its centroid, in km. */
const REACH_PADDING_KM = 4;

export const townReach = (
  passes: readonly Pass[],
  towns: readonly Town[],
  radiusKm = NEARBY_RADIUS_KM,
): TownReach => {
  const out: TownReach = {};
  for (const town of towns) {
    const points = passes.filter((p) => haversine(town, p) <= radiusKm);
    const ring = expandRing(
      convexHull([town, ...points]),
      REACH_PADDING_KM,
    ).map((p) => [p.lon, p.lat] as [number, number]);
    if (ring.length >= 3) out[town.slug] = ring;
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
  radiusKm = NEARBY_RADIUS_KM,
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
