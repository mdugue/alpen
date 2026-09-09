import { createHash } from "node:crypto";

import type { Pass, RouteGeometry, Tour } from "@/lib/types";

// Relative on purpose: next.config.ts loads this module outside the bundler,
// where the "@/" alias is not resolved for transitive imports.
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
 * Never imported by client code – it needs `node:crypto`. It is not marked
 * `server-only` because `next.config.ts` and the Bun script import it outside
 * the React bundler, where that package would throw. Components take the
 * `MapAssets` type only: two URLs and a bounding box per tour.
 */

/** `[west, south, east, north]` in degrees, the GeoJSON bbox order. */
export type Bounds = [number, number, number, number];

/** What the client needs to draw and frame the lines: two URLs and tour bounds. */
export interface MapAssets {
  routesUrl: string;
  toursUrl: string;
  /**
   * Per tour slug: the routed line's bounds, or the waypoints' bounds for a
   * tour without a route – so the client never has to know which it is.
   */
  tourBounds: Record<string, Bounds>;
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

export const bounds = (geom: RouteGeometry): Bounds => {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [lat, lon] of geom) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
};

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
 * The properties are what the popup and the click handler in `pass-map.tsx`
 * read; status and selection come as feature state.
 */
export const routeFeatures = (
  passes: readonly Pass[],
  routes: Record<string, RouteGeometry>,
): LineFeature[] =>
  passes.flatMap((p) =>
    p.ascents.flatMap((a, i) => {
      const key = ascentKey(p.slug, i);
      const geom = routes[key];
      if (!geom) return [];
      return [
        line(key, simplify(geom), {
          id: key,
          kind: "route",
          name: p.name,
          slug: p.slug,
          subtitle: `Auffahrt ab ${a.label}`,
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
        name: t.name,
        slug: t.slug,
        subtitle: `ca. ${t.km} km · ${t.elevationGain.toLocaleString("de-DE")} hm`,
      }),
    ];
  });

/** Where the files live under `public/`, and thus their URL prefix. */
export const MAP_ASSET_DIR = "map";

/** What the script writes and prunes, and what `next.config.ts` caches for a year. */
export const ASSET_NAME = /^(?:routes|tours)\.[0-9a-f]{8}\.geojson$/u;

export interface AssetFile {
  /** `routes.a1b2c3d4.geojson` – the hash is the first 8 hex digits of SHA-256 of `body`. */
  name: string;
  body: string;
  /** Coordinates in the file, after simplification – for the build log. */
  points: number;
}

const assetFile = (kind: "routes" | "tours", c: Collection): AssetFile => {
  const body = JSON.stringify(c);
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 8);
  return {
    body,
    name: `${kind}.${hash}.geojson`,
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
  return {
    assets: {
      routesUrl: `/${MAP_ASSET_DIR}/${routesFile.name}`,
      tourBounds,
      toursUrl: `/${MAP_ASSET_DIR}/${toursFile.name}`,
    },
    files: [routesFile, toursFile],
  };
};
