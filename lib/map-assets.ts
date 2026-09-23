import type { Pass, RouteGeometry, Tour } from "@/lib/types";

// Relative on purpose: next.config.ts loads this module outside the bundler,
// where the "@/" alias is not resolved for transitive imports.
import { canonicalJson, derivedDir } from "./derived-file";
import { bounds } from "./geo";
import type { Bounds } from "./geo";
import { rangeOf } from "./regions";
import type { RangeName } from "./regions";
import { ascentKey, tourKey } from "./route-key";

/**
 * The static GeoJSON files MapLibre loads instead of the page shipping route
 * geometry as React props (docs/plans/01-map-data-out-of-payload.md).
 *
 * `scripts/build-map-assets.ts` writes the files into `public/map/` before
 * `dev` and `build`; `lib/data.ts` calls the same `mapAssets` to learn their
 * names and hands the URLs to the client. Because both sides derive the file
 * name from the same content in the same way, there is no manifest to keep in
 * sync and nothing generated to commit: the name *is* the content hash, which
 * is also what makes the files safe to cache for a year.
 *
 * Never imported by client code – through `lib/derived-file.ts` it reaches
 * `node:crypto` and `node:fs`. It is not marked `server-only` because
 * `next.config.ts` and the Bun script import it outside the React bundler,
 * where that package would throw. Components take the
 * `MapAssets` type only: two URLs and a bounding box per tour.
 */

/** `[west, south, east, north]` in degrees, the GeoJSON bbox order. */

/** What the client needs to draw and frame the lines: two URLs and the bounds. */
export interface MapAssets {
  routesUrl: string;
  toursUrl: string;
  /**
   * Per tour slug: the routed line's bounds, or the waypoints' bounds for a
   * tour without a route – so the client never has to know which it is.
   */
  tourBounds: Record<string, Bounds>;
  /**
   * Per pass slug: every ascent of that pass at once, plus the summit point.
   * A pass is not the dot on the map – it is the roads leading to it, and both
   * sides of a traverse are what "over the Galibier" means – so selecting one
   * frames the whole thing rather than centring on the marker. The summit is
   * folded in so a pass without a routed ascent still has a box, and the
   * numbers are rounded to about ten metres: this travels as a prop for every
   * pass and a frame needs no more.
   */
  passBounds: Record<string, Bounds>;
  /**
   * Per range that has roads: the box around all of them, markers and
   * ascents. What the "Gebirge" chip frames when it is pressed; a range
   * without a road has no box and no chip.
   */
  rangeBounds: Partial<Record<RangeName, Bounds>>;
}

interface LineFeature {
  type: "Feature";
  id: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: Record<string, string>;
}

interface Collection {
  type: "FeatureCollection";
  features: LineFeature[];
}

/** Douglas–Peucker tolerance: below what a 3.5 px line at the closest zoom resolves. */
export const SIMPLIFY_TOLERANCE_M = 5;

const METRES_PER_DEG_LAT = 111_320;
/**
 * Metres per degree of longitude, fixed at cos 45.6°. The Alps span 43.7–49° N
 * (cos 0.66–0.72), so a fixed scale distorts east–west distances by under 8 %
 * of a 5 m tolerance – and it keeps the result identical across JavaScript
 * engines, which the content hash needs: `Math.cos` may differ in its last
 * bit between V8 (Next's server, which derives the file name) and
 * JavaScriptCore (Bun, which writes the file), and one bit is enough to flip
 * a Douglas–Peucker tie and with it the hash. Only IEEE-exact operations
 * (+ − × ÷, comparisons) are used below for the same reason.
 */
const METRES_PER_DEG_LON = 0.7 * METRES_PER_DEG_LAT;

/**
 * Douglas–Peucker in a local equirectangular projection: good to well under a
 * metre over the length of an ascent, and cheap. Endpoints always survive.
 * Iterative rather than recursive, so a 5 000-point route cannot exhaust the
 * stack on a pathological input.
 */
export const simplify = (
  geom: RouteGeometry,
  toleranceM = SIMPLIFY_TOLERANCE_M,
): RouteGeometry => {
  if (geom.length <= 2) return geom;
  const xs = geom.map(([, lon]) => lon * METRES_PER_DEG_LON);
  const ys = geom.map(([lat]) => lat * METRES_PER_DEG_LAT);
  const keep = new Uint8Array(geom.length);
  keep[0] = 1;
  keep[geom.length - 1] = 1;
  const tol2 = toleranceM * toleranceM;
  const stack: [number, number][] = [[0, geom.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = xs[a]!;
    const ay = ys[a]!;
    const dx = xs[b]! - ax;
    const dy = ys[b]! - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let worstD2 = tol2;
    for (let i = a + 1; i < b; i += 1) {
      const px = xs[i]! - ax;
      const py = ys[i]! - ay;
      // Squared distance from the point to the segment a–b.
      const t =
        len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
      const ex = px - t * dx;
      const ey = py - t * dy;
      const d2 = ex * ex + ey * ey;
      if (d2 > worstD2) {
        worstD2 = d2;
        worst = i;
      }
    }
    if (worst < 0) continue;
    keep[worst] = 1;
    stack.push([a, worst], [worst, b]);
  }
  return geom.filter((_, i) => keep[i]);
};

/** Four decimals, about eleven metres – the precision a camera frame needs. */
const round = (b: Bounds): Bounds =>
  b.map((n) => Math.round(n * 1e4) / 1e4) as Bounds;

const line = (
  id: string,
  geom: RouteGeometry,
  properties: Record<string, string>,
): LineFeature => ({
  geometry: {
    coordinates: geom.map(([lat, lon]) => [lon, lat]),
    type: "LineString",
  },
  id,
  properties,
  type: "Feature",
});

/**
 * One line per ascent that has a routed geometry, keyed like `routes.json`.
 *
 * The properties are what the map addresses the line by: `slug` is what the
 * ascent filter and the pick read, `id` is the feature id promoted for feature
 * state. What the hover label says is not among them – it is looked up from
 * the entity (`buildScene`, lib/map-scene.ts), so a line and the dot two
 * hundred metres away cannot say different things about the same road.
 */
export const routeFeatures = (
  passes: readonly Pass[],
  routes: Record<string, RouteGeometry>,
): LineFeature[] =>
  passes.flatMap((p) =>
    p.ascents.flatMap((_, i) => {
      const key = ascentKey(p.slug, i);
      const geom = routes[key];
      if (!geom) return [];
      return [
        line(key, simplify(geom), {
          id: key,
          kind: "route",
          name: p.name,
          slug: p.slug,
          // What the line is drawn with: a gravel ascent is dashed (plan 27).
          surface: p.surface,
        }),
      ];
    }),
  );

/**
 * One line per tour with a routed geometry. A tour without one is left out
 * rather than drawn as a straight line between its waypoints: a chord across
 * a valley says nothing about the road.
 */
export const tourFeatures = (
  tours: readonly Tour[],
  routes: Record<string, RouteGeometry>,
): LineFeature[] =>
  tours.flatMap((t) => {
    const geom = routes[tourKey(t.slug)];
    if (!geom) return [];
    return [
      line(t.slug, simplify(geom), {
        color: t.color,
        id: t.slug,
        kind: "tour",
        // `name` is drawn along the line; `color` paints it.
        name: t.name,
        slug: t.slug,
      }),
    ];
  });

/**
 * The name, the prune pattern and the cache rule of the two GeoJSON files, as
 * one value (`lib/derived-file.ts`): `scripts/build-map-assets.ts` writes and
 * prunes, `next.config.ts` caches, and neither spells the shape a second time.
 */
export const MAP_FILES = derivedDir({
  dir: "map",
  ext: "geojson",
  param: "kind",
  stem: "routes|tours",
});

/** Where the files live under `public/`, and thus their URL prefix. */
export const MAP_ASSET_DIR = MAP_FILES.dir;

export interface AssetFile {
  /** `routes.a1b2c3d4.geojson` – the hash is the first 8 hex digits of SHA-256 of `body`. */
  name: string;
  body: string;
  /** Coordinates in the file, after simplification – for the build log. */
  points: number;
}

const assetFile = (kind: "routes" | "tours", c: Collection): AssetFile => {
  const body = canonicalJson(c);
  return {
    body,
    name: MAP_FILES.name(kind, body),
    points: c.features.reduce((n, f) => n + f.geometry.coordinates.length, 0),
  };
};

/** Both files plus what the client needs to refer to them. */
export const mapAssets = (
  passes: readonly Pass[],
  tours: readonly Tour[],
  routes: Record<string, RouteGeometry>,
): { files: AssetFile[]; assets: MapAssets } => {
  const routesFile = assetFile("routes", {
    features: routeFeatures(passes, routes),
    type: "FeatureCollection",
  });
  const toursFile = assetFile("tours", {
    features: tourFeatures(tours, routes),
    type: "FeatureCollection",
  });
  const tourBounds: Record<string, Bounds> = {};
  for (const t of tours)
    tourBounds[t.slug] = bounds(
      routes[tourKey(t.slug)] ?? t.waypoints.map((w) => [w.lat, w.lon]),
    );
  const passBounds: Record<string, Bounds> = {};
  const byRange = new Map<RangeName, RouteGeometry>();
  for (const p of passes) {
    const points: RouteGeometry = [
      [p.lat, p.lon],
      ...p.ascents.flatMap((_, i) => routes[ascentKey(p.slug, i)] ?? []),
    ];
    passBounds[p.slug] = round(bounds(points));
    const range = rangeOf(p.region);
    byRange.set(range, [...(byRange.get(range) ?? []), ...points]);
  }
  const rangeBounds: Partial<Record<RangeName, Bounds>> = {};
  for (const [range, points] of byRange)
    rangeBounds[range] = round(bounds(points));
  return {
    assets: {
      passBounds,
      rangeBounds,
      routesUrl: MAP_FILES.url(routesFile.name),
      tourBounds,
      toursUrl: MAP_FILES.url(toursFile.name),
    },
    files: [routesFile, toursFile],
  };
};
