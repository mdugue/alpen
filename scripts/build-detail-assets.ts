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
 * carry: profiles for all 201 passes and photo metadata for every entity, both
 * read by one panel about one entity at a time.
 */
import photosJson from "../data/generated/photos.json" with { type: "json" };
import profilesJson from "../data/generated/profiles.json" with { type: "json" };
import passesJson from "../data/passes.json" with { type: "json" };
import toursJson from "../data/tours.json" with { type: "json" };
import townsJson from "../data/towns.json" with { type: "json" };
import { writeDerived } from "../lib/derived-file";
import {
  DETAIL_ASSET_DIR,
  DETAIL_FILES,
  detailAssets,
} from "../lib/detail-assets";
import { profilesWithCoords } from "../lib/profile";
import * as S from "../lib/schema";

const OUT = new URL(`../public/${DETAIL_ASSET_DIR}/`, import.meta.url);
const routesFile = Bun.file(
  new URL("../data/generated/routes.json", import.meta.url),
);

const passes = S.Passes.parse(passesJson);
const tours = S.Tours.parse(toursJson);
const towns = S.Towns.parse(townsJson);
const photos = S.Photos.parse(photosJson);
const profiles = S.Profiles.parse(profilesJson);
// The first `data:build` has not happened yet: a panel without a profile is
// still a panel (same reason as in scripts/build-map-assets.ts).
const routes = S.Routes.parse(
  (await routesFile.exists()) ? await routesFile.json() : {},
);

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
