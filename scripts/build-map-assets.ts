#!/usr/bin/env bun
/**
 * Writes the route geometry as static GeoJSON for MapLibre:
 *
 *   public/map/routes.<hash>.geojson   one LineString per routed ascent
 *   public/map/tours.<hash>.geojson    one LineString per routed tour
 *
 * Runs before `dev` and `build` (package.json), next to the MapLibre worker
 * copy; `public/map` is git-ignored. The hash is the content, so the files are
 * immutable and `next.config.ts` lets them be cached for a year; `lib/data.ts`
 * derives the same names at build time and hands the URLs to the page. Files
 * from earlier runs are removed so a stale hash cannot linger in `public/`.
 *
 * Lines are simplified with Douglas–Peucker at 5 m (lib/map-assets.ts): below
 * what the 3.5 px line resolves at the closest zoom, and about a third of the
 * bytes. The gate has judged the geometry in routes.json; what is simplified
 * here is a rendering copy, the stored data stays untouched.
 */
import { mkdir, readdir, rm } from "node:fs/promises";

import passesJson from "../data/passes.json" with { type: "json" };
import toursJson from "../data/tours.json" with { type: "json" };
import { MAP_ASSET_DIR, mapAssets } from "../lib/map-assets";
import * as S from "../lib/schema";

const OUT = new URL(`../public/${MAP_ASSET_DIR}/`, import.meta.url);
const routesFile = Bun.file(
  new URL("../data/generated/routes.json", import.meta.url),
);

const passes = S.Passes.parse(passesJson);
const tours = S.Tours.parse(toursJson);
// The first `data:build` has not happened yet: an empty map is still a map.
const routes = S.Routes.parse(
  (await routesFile.exists()) ? await routesFile.json() : {},
);

const { files } = mapAssets(passes, tours, routes);

await mkdir(OUT, { recursive: true });
const keep = new Set(files.map((f) => f.name));
for (const name of await readdir(OUT))
  if (!keep.has(name)) await rm(new URL(name, OUT));

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
const points = (body: string) =>
  (
    JSON.parse(body) as { features: { geometry: { coordinates: unknown[] } }[] }
  ).features.reduce((n, f) => n + f.geometry.coordinates.length, 0);
const rawPoints = Object.values(routes).reduce((n, g) => n + g.length, 0);

for (const f of files) {
  await Bun.write(new URL(f.name, OUT), f.body);
  console.log(
    `${MAP_ASSET_DIR}/${f.name}: ${kb(f.body.length)}, ${points(f.body).toLocaleString("en")} points, ${kb(Bun.gzipSync(f.body).length)} gzipped`,
  );
}
console.log(
  `routes.json: ${kb(routesFile.size)} with ${rawPoints.toLocaleString("en")} points before simplification`,
);
