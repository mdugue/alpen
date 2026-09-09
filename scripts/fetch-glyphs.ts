#!/usr/bin/env bun
/**
 * Fetches the glyphs the map's labels need into `public/map/fonts`, once.
 *
 * MapLibre renders text from signed-distance-field glyph atlases, 256 code
 * points per file. The map used to load them from `fonts.openmaptiles.org`
 * on every visit; serving them from the app's own origin removes a runtime
 * dependency and lets the hermetic e2e suite render labels. Only the Latin
 * ranges are kept – every basemap label prefers `name:de`, then the Latin
 * transliteration OpenMapTiles carries for every name, so a glyph outside
 * these ranges is rare, and MapLibre draws such a glyph locally anyway.
 *
 * Source: OpenFreeMap's font server, which builds them from Noto Sans (SIL
 * Open Font License 1.1; the licence is written next to the files). The
 * output is committed, so this script only runs when the fonts or ranges
 * change:
 *
 *   bun run scripts/fetch-glyphs.ts
 */
import { mkdir } from "node:fs/promises";

import { FONT_BOLD, FONT_ITALIC, FONT_REGULAR } from "../lib/basemap";
import { MAP_ASSET_DIR } from "../lib/map-assets";

const ORIGIN = "https://tiles.openfreemap.org/fonts";
const OFL = "https://openfontlicense.org/documents/OFL.txt";
const FONTS = [FONT_REGULAR, FONT_ITALIC, FONT_BOLD];
/** Basic Latin and Latin-1, Latin Extended-A and -B, general punctuation (– ’ …). */
const RANGES = ["0-255", "256-511", "512-767", "8192-8447"];

const OUT = new URL(`../public/${MAP_ASSET_DIR}/fonts/`, import.meta.url);

const fetchOk = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
};

let bytes = 0;
for (const font of FONTS) {
  const dir = new URL(`${font}/`, OUT);
  await mkdir(dir, { recursive: true });
  for (const range of RANGES) {
    const res = await fetchOk(
      `${ORIGIN}/${encodeURIComponent(font)}/${range}.pbf`,
    );
    const body = await res.arrayBuffer();
    bytes += body.byteLength;
    await Bun.write(new URL(`${range}.pbf`, dir), body);
  }
  console.log(`${font}: ${RANGES.join(", ")}`);
}

// The template header with its <placeholders> is replaced by the line above.
const ofl = await fetchOk(OFL);
const oflText = await ofl.text();
const licence = oflText.replace(/^Copyright[\s\S]*?\n\n/u, "");
await Bun.write(
  new URL("LICENSE.txt", OUT),
  `Noto Sans, Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)\n` +
    `Glyph atlases (Latin ranges) as served by OpenFreeMap (https://openfreemap.org), fetched by scripts/fetch-glyphs.ts.\n\n${licence}`,
);
console.log(
  `${Math.round(bytes / 1024).toLocaleString("de-DE")} KB in ${MAP_ASSET_DIR}/fonts`,
);
