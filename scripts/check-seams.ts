#!/usr/bin/env bun
/**
 * One transport per world (docs/architecture.md, "Functional core, imperative
 * shell"): the hash is read and written in one file, a storage key is spelled
 * in one table, the map is moved and its data swapped by the two appliers, and
 * the style is changed only where it is defined. Every other module takes and
 * hands on values.
 *
 *   bun run seams
 *
 * The half of that invariant a lint rule can state – that nothing under `lib/`
 * reaches for `window`, `document`, `localStorage`, `fetch` or MapLibre unless
 * it is one of the named adapters – lives in `oxlint.config.ts`, with the
 * allow-list and a comment per entry. What is left here is the half it cannot:
 * a method call on a map handle and a string literal are ordinary code, and
 * only *where* they stand makes them a leak. So this is the grep the reviewer
 * would otherwise have to remember, run against the app's own source.
 *
 * Adding a seam is a row in `SEAMS`; widening one is a row in its `through`,
 * with the reason in the value – the reason is the point, because a seam with
 * three owners is not a seam any more.
 */
import { Glob } from "bun";

interface Seam {
  /** The world the pattern is a window onto, as the report names it. */
  world: string;
  /** How that world is spelled in this codebase. */
  spelling: RegExp;
  /** The files that may spell it, each with the reason it is the one. */
  through: Record<string, string>;
}

const SEAMS: Seam[] = [
  {
    spelling: /\blocation\.hash\b/u,
    through: {
      "lib/hash-adapter.ts":
        "the hash adapter: the link in as a `load` action, the state out as `history.replaceState`",
    },
    world: "the address bar",
  },
  {
    spelling: /alpenpaesse:/u,
    through: {
      "lib/use-stored.ts":
        "the storage adapter: `PREFIX` and the `STORAGE` table, where every slot is declared with its area and its default",
    },
    world: "web storage",
  },
  {
    // What moves the camera and what changes what is drawn. The rest of the
    // MapLibre surface reads (`getZoom`, `queryRenderedFeatures`) or sets up
    // the style once, and neither is a decision carried out behind the core's
    // back.
    spelling:
      /\.(?:flyTo|easeTo|jumpTo|fitBounds|setPadding|setData|setFilter|setFeatureState|removeFeatureState)\(/u,
    through: {
      "components/map/apply-camera.ts":
        "the camera applier: the commands `camera` (lib/map-camera.ts) hands back, carried out in order",
      "components/map/apply-scene.ts":
        "the scene applier: the difference between the scene the map shows and the one `buildScene` (lib/map-scene.ts) built",
    },
    world: "the map",
  },
  {
    /*
     * The style itself – layers, terrain, the icon atlas – as opposed to the
     * data and the camera above. It is its own seam because it has its own
     * owners: the map's paint lives in `app-layers.ts` as definitions, and
     * `apply-environment.ts` re-applies those definitions when the scheme, the
     * base, an overlay or the 3D switch changes. Without this row the header
     * would claim the two appliers redraw everything, and a reader looking for
     * the hillshade would open `apply-scene.ts` and not find it.
     */
    spelling:
      /\.(?:setPaintProperty|setLayoutProperty|setTerrain|setStyle|addLayer|removeLayer|addSource|removeSource|addImage|updateImage)\(/u,
    through: {
      "components/map/app-layers.ts":
        "where every layer is defined: the base stack is swapped under the running map and the canvas icons are added to it",
      "components/map/apply-environment.ts":
        "the environment applier: the difference between the environment the map is in and the one it should be in, carried out in one fixed order",
    },
    world: "the map's style",
  },
];

/** The app's own source. `components/ui/` is generated and never edited. */
const SOURCE = new Glob("{app,components,lib}/**/*.{ts,tsx}");

const root = new URL("..", import.meta.url).pathname;
const files = [...SOURCE.scanSync(root)]
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => !f.startsWith("components/ui/"))
  .toSorted();

const source = new Map<string, string[]>();
for (const file of files) {
  const text = await Bun.file(`${root}${file}`).text();
  source.set(file, text.split("\n"));
}

const leaks: { seam: Seam; where: string }[] = [];
for (const seam of SEAMS)
  for (const [file, lines] of source) {
    if (seam.through[file]) continue;
    for (const [i, line] of lines.entries())
      if (seam.spelling.test(line))
        leaks.push({ seam, where: `${file}:${i + 1}: ${line.trim()}` });
  }

// English, unlike `data:check`: this one reports to whoever is writing the
// code, next to oxlint's own findings, not to the curator.
console.log(
  `${files.length} files, ${SEAMS.length} seams: ${
    leaks.length === 0 ? "none gone around" : `${leaks.length} gone around`
  }`,
);
if (leaks.length) {
  for (const { seam, where } of leaks) {
    console.error(`\n${where}`);
    console.error(`  ${seam.world} belongs to:`);
    for (const [file, why] of Object.entries(seam.through))
      console.error(`    ${file} – ${why}`);
  }
  console.error(
    "\nEither the access goes through the adapter, or the file joins SEAMS with its reason.",
  );
  process.exit(1);
}
