#!/usr/bin/env bun
/**
 * Writes what the detail panel needs as one static JSON file per entity:
 *
 *   public/detail/pass-<slug>.<hash>.json    profiles of its ascents + photos
 *   public/detail/tour-<slug>.<hash>.json    photos
 *   public/detail/town-<slug>.<hash>.json    photos
 *
 * Runs before `dev` and `build` (package.json), next to the map assets;
 * `public/detail` is git-ignored. The hash is the content, so the files are
 * immutable and `next.config.ts` lets them be cached for a year; `lib/data.ts`
 * derives the same names at build time and hands the page one URL per entity
 * (lib/detail-assets.ts). Files of the same shape from earlier runs are
 * removed so a stale hash cannot linger.
 *
 * What this takes off the page is 374 KB gzipped of the 468 KB it used to
 * carry (then): profiles for all 201 passes and photo metadata for every entity, both
 * read by one panel about one entity at a time.
 */
import { writeDerived } from "../lib/derived-file";
import {
  DETAIL_ASSET_DIR,
  DETAIL_FILES,
  detailAssets,
} from "../lib/detail-assets";
import { profilesWithCoords } from "../lib/profile";
import { mustRead } from "./lib/data-files";

const OUT = new URL(`../public/${DETAIL_ASSET_DIR}/`, import.meta.url);

// Every file read through the one pair (scripts/lib/data-files.ts), which is
// also where "the first `data:build` has not happened yet" is answered: a
// generated file that is still missing reads as its `FILES.empty` value, and a
// panel without a profile is still a panel.
const passes = await mustRead("passes.json");
const tours = await mustRead("tours.json");
const towns = await mustRead("towns.json");
const photos = await mustRead("generated/photos.json");
const profiles = await mustRead("generated/profiles.json");
const routes = await mustRead("generated/routes.json");

// The same function `lib/data.ts` runs to derive the names: the file name is a
// hash of what it returns, so the two sides cannot spell this differently.
const { files } = detailAssets(
  passes,
  tours,
  towns,
  profilesWithCoords(profiles, routes),
  photos,
);

await writeDerived({ files, out: OUT, prune: DETAIL_FILES.prune });

let bytes = 0;
let gzipped = 0;
for (const f of files) {
  bytes += f.body.length;
  gzipped += Bun.gzipSync(f.body).length;
}

const kb = (n: number) => `${Math.round(n / 1024).toLocaleString("de-DE")} KB`;
console.log(
  `${DETAIL_ASSET_DIR}/: ${files.length.toLocaleString("de-DE")} Dateien, ${kb(bytes)}, ${kb(gzipped)} gzip, ` +
    `im Schnitt ${kb(gzipped / Math.max(files.length, 1))} pro Auswahl`,
);
