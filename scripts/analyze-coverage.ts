#!/usr/bin/env bun
/**
 * Coverage report per base town: which paved passes within its reach the app
 * does not list (docs/plans/24-depth-per-destination.md).
 *
 *   bun run scripts/analyze-coverage.ts                 # every town
 *   bun run scripts/analyze-coverage.ts bormio cuneo    # matching slugs only
 *   bun run scripts/analyze-coverage.ts --floor 600     # count candidates from 600 m
 *   bun run scripts/analyze-coverage.ts --top 8         # names per band
 *   bun run scripts/analyze-coverage.ts --refresh       # ask Overpass again
 *
 * In the family of analyze-status.ts and analyze-destinations.ts: it prints,
 * it writes nothing under data/. "Depth" – how many roads a base reaches –
 * used to be a feeling; this is the number, so curation goes where a base is
 * thin rather than where a name is famous.
 *
 * For every town it asks Overpass once for the `mountain_pass` and
 * `natural=saddle` nodes within REACH_MAX_KM (lib/geo.ts) that have a paved
 * road within 300 m, and matches them against data/passes.json: a node within
 * 500 m of a marker is that entry, the rest are candidates, sorted by
 * elevation because in the Alps that is the best free proxy for "worth a
 * holiday". The human decides; nothing here becomes data.
 *
 * The answers are cached per bounding box in scripts/.cache/coverage (git-
 * ignored), so the second run is offline and free. Overpass is the only host
 * that can answer a 75 km circle – the OSM map API's fallback in osm.ts stops
 * at a bounding box a few kilometres wide – so when it is down the run says
 * so and stops; OVERPASS_URL picks a mirror.
 */
import { mkdir } from "node:fs/promises";

import passesJson from "../data/passes.json" with { type: "json" };
import townsJson from "../data/towns.json" with { type: "json" };
import { REACH_MAX_KM } from "../lib/geo";
import * as S from "../lib/schema";
import {
  coverageOf,
  coverageQuery,
  FLOORS,
  reportLines,
  summaryLine,
} from "./lib/coverage";
import { overpassPost } from "./lib/locate";
import type { OverpassNode } from "./lib/locate";
import { OVERPASS_URL } from "./lib/osm";

const passes = S.Passes.parse(passesJson);
const towns = S.Towns.parse(townsJson);

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(name);
  const v = i === -1 ? Number.NaN : Number(args[i + 1]);
  return Number.isFinite(v) ? v : fallback;
};
const FLOOR = flag("--floor", 1000);
const TOP = flag("--top", 6);
const REFRESH = args.includes("--refresh");
const only = args.filter(
  (a, i) =>
    !a.startsWith("--") && args[i - 1] !== "--floor" && args[i - 1] !== "--top",
);
const selected = only.length
  ? towns.filter((t) => only.some((o) => t.slug.includes(o)))
  : towns;

const CACHE = new URL(".cache/coverage/", import.meta.url);
await mkdir(CACHE, { recursive: true });
/** Between two Overpass requests, ms – a public mirror, asked politely. */
const GAP_MS = 2000;

const nodesAround = async (t: {
  lat: number;
  lon: number;
}): Promise<{ cached: boolean; nodes: OverpassNode[] }> => {
  const file = Bun.file(
    new URL(
      `${t.lat.toFixed(3)}_${t.lon.toFixed(3)}_${REACH_MAX_KM}.json`,
      CACHE,
    ),
  );
  if (!REFRESH && (await file.exists()))
    return { cached: true, nodes: (await file.json()) as OverpassNode[] };
  const res = await fetch(OVERPASS_URL, overpassPost(coverageQuery(t)));
  if (!res.ok) throw new Error(`Overpass ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { elements?: OverpassNode[] };
  const nodes = (json.elements ?? []).filter((e) => e.type === "node");
  await Bun.write(file, JSON.stringify(nodes));
  return { cached: false, nodes };
};

console.log(
  `Abdeckung je Basis, Umkreis ${REACH_MAX_KM} km, Kandidaten ab ${FLOOR} m (--floor), ${selected.length} Orte, Overpass: ${new URL(OVERPASS_URL).host}\n`,
);

const rows: string[] = [];
let asked = 0;
const distinct = new Set<number>();
for (const t of selected) {
  let answer: Awaited<ReturnType<typeof nodesAround>>;
  try {
    if (asked > 0) await Bun.sleep(GAP_MS);
    answer = await nodesAround(t);
  } catch (error) {
    console.error(
      `${t.name}: Overpass antwortet nicht (${(error as Error).message}) – dieser Bericht braucht den Host; OVERPASS_URL=… wählt einen Spiegel`,
    );
    process.exit(1);
  }
  if (!answer.cached) asked += 1;
  const cov = coverageOf(t, answer.nodes, passes, FLOOR);
  for (const line of reportLines(t, cov, TOP)) console.log(line);
  console.log();
  const byFloor = Object.fromEntries(
    FLOORS.map((f) => [
      f,
      Object.values(coverageOf(t, answer.nodes, passes, f).candidates).flat()
        .length,
    ]),
  );
  for (const c of Object.values(cov.candidates).flat()) distinct.add(c.osm);
  rows.push(
    `${String(cov.listed.day.length + cov.listed.door.length).padStart(4)}|${summaryLine(t, cov, byFloor)}`,
  );
}

console.log(
  `${"Ort".padEnd(26)}${"gelistet".padStart(12)}${"Kandidaten".padStart(15)}${"einseitig".padStart(12)}${"ab 600/1000 m".padStart(15)}`,
);
console.log(
  `${"(dünnste Tagesrunde zuerst)".padEnd(26)}${" Tür Tag Ausf".padStart(12)}${" Tür Tag Ausf".padStart(15)}`,
);
for (const row of rows.toSorted(
  (a, b) => Number(a.split("|")[0]) - Number(b.split("|")[0]),
))
  console.log(row.slice(row.indexOf("|") + 1));
console.log(
  `\n${selected.length} Orte, ${asked} Overpass-Anfragen (${selected.length - asked} aus dem Cache), ${distinct.size} verschiedene Kandidaten ab ${FLOOR} m`,
);
