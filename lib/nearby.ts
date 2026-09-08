import { haversine, NEARBY_RADIUS_KM } from "@/lib/geo";
import type { LatLon, Pass, RouteGeometry, Tour, Town } from "@/lib/types";

/**
 * Which tours pass within `NEARBY_RADIUS_KM` of each entity, precomputed on
 * the server so the detail panel's "Im Umkreis" list needs no tour geometry
 * on the client (docs/plans/01-map-data-out-of-payload.md). Passes and towns
 * nearby are still measured in the panel: those are points, and a hundred
 * haversines are nothing – it is the walk along 60 000 route coordinates
 * that had to go.
 *
 * Key: `pass:<slug>`, `tour:<slug>` (measured from the tour's first waypoint,
 * as the panel does) or `town:<slug>`; value: tour slugs in `tours.json` order.
 */
export type NearbyTours = Record<string, string[]>;

export const nearbyKey = (kind: "pass" | "tour" | "town", slug: string) =>
  `${kind}:${slug}`;

/** A tour without a routed geometry is judged by its waypoints, as before. */
const tourLine = (
  tour: Tour,
  routes: Record<string, RouteGeometry>,
): RouteGeometry =>
  routes[`tour:${tour.slug}`] ?? tour.waypoints.map((w) => [w.lat, w.lon]);

const within = (line: RouteGeometry, at: LatLon, km: number) =>
  line.some(([lat, lon]) => haversine(at, { lat, lon }) <= km);

export const nearbyTours = (
  passes: readonly Pass[],
  tours: readonly Tour[],
  towns: readonly Town[],
  routes: Record<string, RouteGeometry>,
  radiusKm = NEARBY_RADIUS_KM,
): NearbyTours => {
  const lines = tours.map((t) => [t.slug, tourLine(t, routes)] as const);
  const near = (at: LatLon) =>
    lines.filter(([, line]) => within(line, at, radiusKm)).map(([s]) => s);
  const out: NearbyTours = {};
  for (const p of passes) out[nearbyKey("pass", p.slug)] = near(p);
  for (const t of tours) out[nearbyKey("tour", t.slug)] = near(t.waypoints[0]!);
  for (const t of towns) out[nearbyKey("town", t.slug)] = near(t);
  return out;
};
