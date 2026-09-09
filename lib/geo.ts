import type { LatLon } from "@/lib/types";

/** Great-circle distance in km. */
export const haversine = (a: LatLon, b: LatLon): number => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export const NEARBY_RADIUS_KM = 60;

/**
 * Convex hull of a set of points (monotone chain), in the input's own units –
 * over the small spans this app draws, treating lon/lat as a plane is well
 * inside the line width. Returns the hull counter-clockwise without repeating
 * the first point; fewer than three distinct points have no hull and yield an
 * empty ring.
 */
const cross = (o: LatLon, a: LatLon, b: LatLon) =>
  (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);

export const convexHull = (points: readonly LatLon[]): LatLon[] => {
  const pts = [
    ...new Map(points.map((p) => [`${p.lat},${p.lon}`, p])).values(),
  ].toSorted((a, b) => a.lon - b.lon || a.lat - b.lat);
  if (pts.length < 3) return [];
  const half = (input: LatLon[]) => {
    const out: LatLon[] = [];
    for (const p of input) {
      while (out.length > 1 && cross(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half(pts.toReversed())];
};

/**
 * Pushes every vertex of a ring away from its centroid by `km`, so a hull
 * drawn through points reads as an area around them rather than a polygon
 * that cuts through them.
 */
export const expandRing = (ring: readonly LatLon[], km: number): LatLon[] => {
  if (ring.length === 0) return [];
  const n = ring.length;
  const c = {
    lat: ring.reduce((s, p) => s + p.lat, 0) / n,
    lon: ring.reduce((s, p) => s + p.lon, 0) / n,
  };
  return ring.map((p) => {
    const d = haversine(c, p);
    if (d === 0) return { ...p };
    const f = (d + km) / d;
    return {
      lat: c.lat + (p.lat - c.lat) * f,
      lon: c.lon + (p.lon - c.lon) * f,
    };
  });
};
