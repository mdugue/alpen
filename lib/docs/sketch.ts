/**
 * The picture the /wissen pages carry: every routed road of the app, drawn as
 * one thin line each, with a dot per summit. It is the app's own geometry
 * (data/generated/routes.json), so the knowledge base shows what the map is
 * made of rather than a stock photo – the whole range on the entry page, one
 * region per page above the others.
 *
 * Pure: projected (Web Mercator, like the map) and thinned to what a pixel can
 * show, so the SVG stays small enough to inline.
 */

/** `[lat, lon]`, the order the route files store. */
export type LatLon = readonly [number, number];

/** `[west, south, east, north]` in degrees. */
export type Box = readonly [number, number, number, number];

export interface Sketch {
  width: number;
  height: number;
  /** One path for all roads, in relative commands. */
  roads: string;
  /** The summits inside the box, in pixels. */
  summits: [number, number][];
}

const mercator = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** Perpendicular distance of `p` from the segment `a`–`b`. */
const offset = (
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return len === 0
    ? Math.hypot(p[0] - a[0], p[1] - a[1])
    : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
};

/** Douglas–Peucker: the fewest points that stay within `tolerance`. */
export const simplify = (
  points: readonly (readonly [number, number])[],
  tolerance: number,
): [number, number][] => {
  if (points.length < 3) {
    return points.map(([x, y]) => [x, y]);
  }
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() ?? [0, 0];
    const a = points[first] ?? [0, 0];
    const b = points[last] ?? [0, 0];
    let worst = 0;
    let at = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = offset(points[i] ?? a, a, b);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at > 0 && worst > tolerance) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }
  return points.flatMap(([x, y], i) => (keep[i] ? [[x, y]] : []));
};

/** The box around `points`, grown by `pad` of its size on every side. */
export const boxOf = (points: readonly LatLon[], pad = 0): Box => {
  const lats = points.map((p) => p[0]);
  const lons = points.map((p) => p[1]);
  const [s, n] = [Math.min(...lats), Math.max(...lats)];
  const [w, e] = [Math.min(...lons), Math.max(...lons)];
  const dLat = (n - s) * pad;
  const dLon = (e - w) * pad;
  return [w - dLon, s - dLat, e + dLon, n + dLat];
};

/**
 * The roads and summits inside `box`, projected onto a canvas `width` pixels
 * wide (the height follows the box). A road that only touches the box is kept
 * whole – the viewBox cuts it – and every road is thinned to `tolerance`
 * pixels and rounded to whole ones.
 */
export const sketch = (
  roads: readonly (readonly LatLon[])[],
  summits: readonly LatLon[],
  box: Box,
  width: number,
  tolerance = 0.6,
): Sketch => {
  const [w, s, e, n] = box;
  const scale = width / (e - w);
  const top = mercator(n);
  const height = Math.round(((top - mercator(s)) * 180 * scale) / Math.PI);
  const project = ([lat, lon]: LatLon): [number, number] => [
    (lon - w) * scale,
    ((top - mercator(lat)) * 180 * scale) / Math.PI,
  ];
  const inside = ([lat, lon]: LatLon) =>
    lat >= s && lat <= n && lon >= w && lon <= e;

  const parts: string[] = [];
  for (const road of roads) {
    if (!road.some(inside)) {
      continue;
    }
    const line = simplify(road.map(project), tolerance).map(
      ([x, y]) => [Math.round(x), Math.round(y)] as const,
    );
    const [start, ...rest] = line;
    if (!start) {
      continue;
    }
    let path = `M${start[0]} ${start[1]}`;
    let [px, py] = start;
    for (const [x, y] of rest) {
      if (x !== px || y !== py) {
        const dy = y - py;
        path += `l${x - px}${dy < 0 ? "" : " "}${dy}`;
        [px, py] = [x, y];
      }
    }
    if (path.includes("l")) {
      parts.push(path);
    }
  }
  return {
    height,
    roads: parts.join(""),
    summits: summits.filter(inside).map((p) => {
      const [x, y] = project(p);
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    }),
    width,
  };
};
