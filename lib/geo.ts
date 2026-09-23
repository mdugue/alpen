import type { LatLon } from "@/lib/types";

/** `[west, south, east, north]` in degrees – the box MapLibre frames. */
export type Bounds = [number, number, number, number];

/**
 * The box around a list of `[lat, lon]` points. Here rather than beside the
 * map assets, where it started: the assets module needs node's crypto and fs
 * and is never imported by client code, while the box around a destination's
 * members is read by the panel and the scene.
 */
export const bounds = (
  points: readonly (readonly [number, number])[],
): Bounds => {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lat, lon] of points) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
};

/**
 * A circle of `radiusKm` around a point as a closed ring of `[lon, lat]`
 * pairs – what a padded hull is built from. Flat-earth over one degree of
 * latitude, with the longitude stretched by the cosine: at 75 km the error
 * is well under the width of the line it is drawn with.
 */
const circleRing = (
  center: LatLon,
  radiusKm: number,
  steps = 48,
): [number, number][] => {
  const dLat = radiusKm / 111.32;
  const dLon = dLat / Math.cos((center.lat * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([
      center.lon + dLon * Math.cos(a),
      center.lat + dLat * Math.sin(a),
    ]);
  }
  return ring;
};

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

/**
 * How far a road may sit from a base and still count as "reachable from
 * here". It is deliberately larger than the 60 km this used to be: the
 * previous number put a hard wall between a pass at 59 km and one at 61,
 * and a wall is the wrong shape for the question. The shape is `REACH_BANDS`
 * below – the cut-off only says where the list stops, and it stops where a
 * pass genuinely stops being part of a holiday *here* rather than a reason to
 * stay somewhere else.
 */
export const REACH_MAX_KM = 75;

/**
 * Distance, as a rider thinks of it instead of as a number.
 *
 * A radius answers "is it in?" and nothing else, so a pass 1 km away and one
 * 59 km away read the same while one at 61 km is gone. Both halves of that are
 * wrong: the near pass is a different *kind* of thing from the far one, and
 * the far one does not stop mattering at a round number.
 *
 * Two mechanisms replace the one radius, and they are deliberately different
 * so that neither has to do the other's job:
 *
 *  - **Bands** are what a person reads. Three of them, each named after what
 *    it means for a day on the bike: ride out of the door, a day's loop, or a
 *    drive first. A band is a sentence ("vier Pässe vor der Haustür"), which
 *    a weight can never be – nobody can read "Gewicht 0,62".
 *  - **A weight** is what the machine ranks with. It falls smoothly from 1 at
 *    the door to 0 at `REACH_MAX_KM`, so ordering a list by
 *    `beauty × rideability × reachWeight` puts a good near pass above an
 *    equally good far one without anyone having to see the number.
 *
 * That split is the whole idea: the gradient does the ranking, where it is
 * felt and never read; the bands do the explaining, where they are read and
 * never computed with. The visitor is asked for no radius and shown no
 * weight.
 */
export const REACH_BANDS = [
  { key: "door", maxKm: 18 },
  { key: "day", maxKm: 45 },
  { key: "trip", maxKm: REACH_MAX_KM },
] as const;

export type ReachBand = (typeof REACH_BANDS)[number]["key"];

/** Which band a distance falls into; `null` beyond `REACH_MAX_KM`. */
export const reachBand = (km: number): ReachBand | null =>
  REACH_BANDS.find((b) => km <= b.maxKm)?.key ?? null;

/**
 * 1 at the door, 0 at `REACH_MAX_KM` and beyond, smooth in between – a
 * cosine ease rather than a straight line, so the first kilometres out of
 * town cost almost nothing (they genuinely do not: 5 km of valley is a
 * warm-up) and the last ones cost a lot.
 */
export const reachWeight = (km: number): number => {
  if (km <= 0) return 1;
  if (km >= REACH_MAX_KM) return 0;
  return (1 + Math.cos((km / REACH_MAX_KM) * Math.PI)) / 2;
};

/** The turn from `o` to `a` to `b`: positive counter-clockwise. */
const cross = (o: LatLon, a: LatLon, b: LatLon) =>
  (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);

/**
 * Convex hull of a set of points (monotone chain), in the input's own units –
 * over the small spans this app draws, treating lon/lat as a plane is well
 * inside the line width. Returns the hull counter-clockwise without repeating
 * the first point; fewer than three distinct points have no hull and yield an
 * empty ring.
 */
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
 * A closed ring of `[lon, lat]` pairs – the first pair repeated last, as
 * GeoJSON asks for it. MapLibre fills an open ring as well, but its line
 * layer strokes the closing edge only where a tile happens to clip the ring,
 * so an outline drawn from an open one misses a side.
 */
export type Ring = readonly (readonly [number, number])[];

/**
 * The area a set of points covers, padded by `km` all round: the convex hull
 * of a small circle around each point. It reads as a region around the points
 * rather than a polygon cutting through them, and it stays one where the
 * points do not span one – a valley's roads in a line make a band, not a
 * sliver. What the map draws a town's reach and a destination with. Rounded
 * to about a hundred metres: it travels to the page, and a drawn edge needs
 * no more.
 */
export const paddedHull = (points: readonly LatLon[], km: number): Ring => {
  const ring = convexHull(
    points.flatMap((p) =>
      circleRing(p, km, 12).map(([lon, lat]) => ({ lat, lon })),
    ),
  ).map(
    (p) =>
      [
        Math.round(p.lon * 1000) / 1000,
        Math.round(p.lat * 1000) / 1000,
      ] as const,
  );
  return ring.length > 0 ? [...ring, ring[0]!] : [];
};
