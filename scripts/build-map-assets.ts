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
 * of the same shape from earlier runs are removed so a stale hash cannot
 * linger; anything else under `public/map` (plan 06 puts style files there)
 * is left alone.
 *
 * Lines are simplified with Douglas–Peucker at 5 m (lib/map-assets.ts): below
 * what the 3.5 px line resolves at the closest zoom, and about a third of the
 * bytes. The gate has judged the geometry in routes.json; what is simplified
 * here is a rendering copy, the stored data stays untouched.
 */
import { writeDerived } from "../lib/derived-file";
import { MAP_ASSET_DIR, MAP_FILES, mapAssets } from "../lib/map-assets";
import { FILES } from "../lib/schema";
import { mustRead, render } from "./lib/data-files";

const OUT = new URL(`../public/${MAP_ASSET_DIR}/`, import.meta.url);

const passes = await mustRead("passes.json");
const tours = await mustRead("tours.json");
// Missing before the first `data:build`, and then an empty map is still a map:
// which files may be absent and what they read as is `FILES` (lib/schema.ts).
const routes = await mustRead("generated/routes.json");

const { files } = mapAssets(passes, tours, routes);
await writeDerived({ files, out: OUT, prune: MAP_FILES.prune });

const kb = (n: number) => `${Math.round(n / 1024).toLocaleString("de-DE")} KB`;
const count = (n: number) => n.toLocaleString("de-DE");
const rawPoints = Object.values(routes).reduce((n, g) => n + g.length, 0);
// The stored size, without reading the file a second time: `data:check` holds
// it to exactly this rendering, so the two cannot drift apart.
const rawBytes = render(FILES["generated/routes.json"].layout, routes).length;

for (const f of files)
  console.log(
    `${MAP_ASSET_DIR}/${f.name}: ${kb(f.body.length)}, ${count(f.points)} Punkte, ${kb(Bun.gzipSync(f.body).length)} gzip`,
  );
console.log(
  `routes.json: ${kb(rawBytes)} mit ${count(rawPoints)} Punkten vor der Vereinfachung`,
);
