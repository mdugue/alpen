#!/usr/bin/env bun
/**
 * Writes the generated basemap as two complete MapLibre styles:
 *
 *   public/map/style-light.json
 *   public/map/style-dark.json
 *
 * The app does not fetch them – `components/map/pass-map.tsx` imports
 * `lib/basemap.ts` and composes the same layers with its own – but a style
 * file is what a style editor (Maputnik and friends) opens, and tuning the
 * basemap is easier there than by reloading the app. The glyph URL is made
 * absolute for that reason: `lib/basemap.ts` has it relative, the app's own
 * origin serves the fonts.
 *
 * Runs before `dev` and `build` (package.json), next to the route geometry;
 * `public/map` is git-ignored except for the fonts.
 */
import { basemapStyle, GLYPHS } from "../lib/basemap";
import { siteUrl } from "../lib/brand";
import { writeDerived } from "../lib/derived-file";
import { LANGS, langPrefix } from "../lib/i18n/lang";
import { MAP_ASSET_DIR } from "../lib/map-assets";

const OUT = new URL(`../public/${MAP_ASSET_DIR}/`, import.meta.url);

// No hash and no pruning: the two names are fixed, and the geometry files
// beside them belong to scripts/build-map-assets.ts, which runs first.
const files = (["light", "dark"] as const).flatMap((scheme) =>
  LANGS.map((lang) => ({
    body: JSON.stringify(basemapStyle(scheme, `${siteUrl}${GLYPHS}`, lang)),
    name: `style-${scheme}${langPrefix(lang).replace("/", "-")}.json`,
  })),
);
await writeDerived({ files, out: OUT });

for (const f of files)
  console.log(
    `${MAP_ASSET_DIR}/${f.name}: ${Math.round(f.body.length / 1024).toLocaleString("de-DE")} KB`,
  );
