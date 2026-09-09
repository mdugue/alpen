#!/usr/bin/env bun
/**
 * Builds the glyphs the map's labels need into `public/map/fonts`, once.
 *
 * MapLibre renders text from signed-distance-field glyph atlases, 256 code
 * points per file, so the UI's font cannot be used as a web font: it has to
 * be rasterised ahead of time. This does that for Inter – the family the
 * rest of the app is set in – so map and panels share one face. Only the
 * Latin ranges are kept: every basemap label prefers `name:de`, then the
 * Latin transliteration OpenMapTiles carries for every name, so a glyph
 * outside them is rare, and MapLibre draws such a glyph locally anyway.
 *
 * Inputs, fetched into the git-ignored `scripts/.cache` on first run:
 * the Inter release (static TTFs, SIL Open Font License 1.1 – the licence is
 * written next to the output) and fontnik, the rasteriser MapLibre's own
 * font tooling uses, installed there rather than as a dependency of the app.
 * The output is committed, so this runs only when the font or the ranges
 * change:
 *
 *   bun run map:glyphs
 */
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { promisify } from "node:util";

import { FONT_BOLD, FONT_ITALIC, FONT_REGULAR } from "../lib/basemap";
import { MAP_ASSET_DIR } from "../lib/map-assets";

const INTER_VERSION = "4.1";
const INTER_ZIP = `https://github.com/rsms/inter/releases/download/v${INTER_VERSION}/Inter-${INTER_VERSION}.zip`;
const FONTNIK = "fontnik@0.7.7";
/** Fontstack name → static TTF inside the release zip. */
const FONTS: Record<string, string> = {
  [FONT_REGULAR]: "Inter-Regular.ttf",
  [FONT_ITALIC]: "Inter-Italic.ttf",
  [FONT_BOLD]: "Inter-SemiBold.ttf",
};
/** Basic Latin and Latin-1, Latin Extended-A and -B, general punctuation (– ’ …). */
const RANGES: [number, number][] = [
  [0, 255],
  [256, 511],
  [512, 767],
  [8192, 8447],
];

const CACHE = new URL(".cache/glyphs/", import.meta.url);
const OUT = new URL(`../public/${MAP_ASSET_DIR}/fonts/`, import.meta.url);

const run = async (cmd: string[], cwd?: string) => {
  const p = Bun.spawn(cmd, { cwd, stderr: "inherit", stdout: "inherit" });
  if ((await p.exited) !== 0) throw new Error(`${cmd.join(" ")} failed`);
};

await mkdir(CACHE, { recursive: true });

// 1. The font.
const zip = new URL(`Inter-${INTER_VERSION}.zip`, CACHE);
if (!existsSync(zip)) {
  const res = await fetch(INTER_ZIP);
  if (!res.ok) throw new Error(`${res.status} for ${INTER_ZIP}`);
  await Bun.write(zip, await res.arrayBuffer());
}
const ttfDir = new URL("ttf/", CACHE);
await run([
  "unzip",
  "-o",
  "-q",
  "-j",
  zip.pathname,
  ...Object.values(FONTS).map((f) => `extras/ttf/${f}`),
  "LICENSE.txt",
  "-d",
  ttfDir.pathname,
]);

// 2. The rasteriser, kept out of package.json: a native addon for a one-off.
const toolDir = new URL("fontnik/", CACHE);
if (!existsSync(new URL("node_modules/fontnik/", toolDir))) {
  await mkdir(toolDir, { recursive: true });
  await Bun.write(
    new URL("package.json", toolDir),
    JSON.stringify({ name: "glyph-tool", private: true }),
  );
  await run(["bun", "add", FONTNIK], toolDir.pathname);
}
const fontnik = createRequire(toolDir)("fontnik") as {
  range: (
    opts: { font: Buffer; start: number; end: number },
    cb: (err: Error | null, pbf: Buffer) => void,
  ) => void;
};
const range = promisify(fontnik.range);

// 3. The atlases, one directory per fontstack name as MapLibre asks for them.
await rm(OUT, { force: true, recursive: true });
let bytes = 0;
for (const [name, file] of Object.entries(FONTS)) {
  const font = Buffer.from(await Bun.file(new URL(file, ttfDir)).arrayBuffer());
  const dir = new URL(`${name}/`, OUT);
  await mkdir(dir, { recursive: true });
  for (const [start, end] of RANGES) {
    const pbf = await range({ end, font, start });
    bytes += pbf.byteLength;
    await Bun.write(new URL(`${start}-${end}.pbf`, dir), pbf);
  }
  console.log(
    `${name} ← ${file}: ${RANGES.map(([a, b]) => `${a}-${b}`).join(", ")}`,
  );
}

const licence = await Bun.file(new URL("LICENSE.txt", ttfDir)).text();
await Bun.write(
  new URL("LICENSE.txt", OUT),
  `Inter ${INTER_VERSION} (https://github.com/rsms/inter), rasterised to MapLibre glyph atlases (Latin ranges) by scripts/build-glyphs.ts.\n\n${licence}`,
);
console.log(
  `${Math.round(bytes / 1024).toLocaleString("de-DE")} KB in ${MAP_ASSET_DIR}/fonts`,
);
