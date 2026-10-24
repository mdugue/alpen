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
 *   bun run scripts/analyze-coverage.ts --tours [slug…] # what each tour rides over
 *   bun run scripts/analyze-coverage.ts --tours --climbs [slug…] # and every climb on it
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
 * The answers are recorded per query in scripts/.cache/coverage (git-ignored)
 * by the fixture transport, so the second run is offline and free. The gap
 * between two live requests is the transport's Overpass pace – 3 s, the rate
 * every script keeps towards that host – rather than the 2 s this report used
 * to time itself. Overpass is the only host that can answer a 75 km circle –
 * the OSM map API's fallback in osm.ts stops at a bounding box a few
 * kilometres wide – so when it is down the run says so and stops;
 * OVERPASS_URL picks a mirror.
 *
 * `--tours` asks the other question: not what a base reaches but what a tour
 * rides over. For every stored tour line it asks for the saddles in the box
 * around it and prints the entries the line crosses that the tour's `passes`
 * do not name, and the saddles from 600 m (`TOUR_FLOOR`) that are no entry at
 * all. A base-centred report cannot see those: a loop from Lienz crosses
 * three roads no base's circle had made anyone write down.
 *
 * `--climbs` adds what no saddle node shows: every rise of 150 m or more on
 * the line's own profile (`scripts/lib/climbs.ts`), heights from OpenTopoData
 * and recorded like the Overpass answers. A climb whose top is an entry the
 * tour names is quiet; the report prints the others – an entry the tour does
 * not name, or no entry at all, with its foot, its top, its gain and whether
 * the line rides it up and back down (a spur).
 */
import routesJson from "../data/generated/routes.json" with { type: "json" };
import passesJson from "../data/passes.json" with { type: "json" };
import toursJson from "../data/tours.json" with { type: "json" };
import townsJson from "../data/towns.json" with { type: "json" };
import { REACH_MAX_KM } from "../lib/geo";
import { ascentKey, tourKey } from "../lib/route-key";
import * as S from "../lib/schema";
import {
  CLIMB_MIN_GAIN,
  climbsOf,
  fillGaps,
  matchClimbs,
  resample,
} from "./lib/climbs";
import type { Climb } from "./lib/climbs";
import {
  candidateLine,
  coverageOf,
  coverageQuery,
  FLOORS,
  reportLines,
  summaryLine,
  TOUR_FLOOR,
  tourCoverage,
  tourQuery,
} from "./lib/coverage";
import { OVERPASS_URL, openTopoData, overpass } from "./lib/hosts";
import type { OverpassNode } from "./lib/hosts";
import { fixtureTransport, liveTransport } from "./lib/transport";

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
const TOURS = args.includes("--tours");
const CLIMBS = args.includes("--climbs");
const selected = only.length
  ? towns.filter((t) => only.some((o) => t.slug.includes(o)))
  : towns;

/** Recorded answers; `--refresh` asks Overpass again and overwrites them. */
const transport = fixtureTransport(
  new URL(".cache/coverage/", import.meta.url),
  { live: liveTransport(), record: REFRESH },
);

const nodesAround = async (t: {
  lat: number;
  lon: number;
}): Promise<OverpassNode[]> => {
  const elements = await overpass.query(transport, coverageQuery(t));
  return elements.filter((e): e is OverpassNode => e.type === "node");
};

/** One climb as the curator reads it: where, how high, how much, what kind. */
const climbLine = (c: Climb): string =>
  `km ${c.foot.km.toFixed(0)}–${c.top.km.toFixed(0)}: ${Math.round(c.foot.ele)} → ${Math.round(c.top.ele)} m, +${c.gain} Hm, ${c.grade} %` +
  `${c.outAndBack ? ", hinauf und zurück" : ""} · Fuß ${c.foot.lat.toFixed(4)}, ${c.foot.lon.toFixed(4)} · Gipfel ${c.top.lat.toFixed(4)}, ${c.top.lon.toFixed(4)}`;

if (TOURS) {
  const tours = S.Tours.parse(toursJson).filter(
    (t) => !only.length || only.some((o) => t.slug.includes(o)),
  );
  const routes = routesJson as unknown as Record<string, [number, number][]>;
  const floor = flag("--floor", TOUR_FLOOR);
  console.log(
    `Was jede Tour überfährt, Sättel ab ${floor} m (--floor), ${tours.length} Touren, Overpass: ${new URL(OVERPASS_URL).host}\n`,
  );
  let incomplete = false;
  for (const t of tours) {
    const line = routes[tourKey(t.slug)];
    if (!line) {
      console.log(
        `${t.name}: keine Route gespeichert – erst bun run data:build`,
      );
      continue;
    }
    let nodes: OverpassNode[] | null = null;
    try {
      const elements = await overpass.query(transport, tourQuery(line));
      nodes = elements.filter((e): e is OverpassNode => e.type === "node");
    } catch (error) {
      console.error(
        `${t.name}: Overpass antwortet nicht (${(error as Error).message}) – OVERPASS_URL=… wählt einen Spiegel`,
      );
      // The climbs need no Overpass: report them without the saddles.
      if (!CLIMBS) process.exit(1);
      incomplete = true;
    }
    const cov = tourCoverage(t, line, nodes ?? [], passes, floor);
    console.log(`${t.name} (${t.passes.length} Pässe gelistet)`);
    if (!nodes)
      console.log("  Sättel: nicht gefragt, Overpass antwortet nicht");
    if (cov.unnamed.length)
      console.log(
        `  überfahren, nicht in passes: ${cov.unnamed.map((p) => p.slug).join(", ")}`,
      );
    if (cov.candidates.length)
      console.log(
        `  Sättel ohne Eintrag: ${cov.candidates.map(candidateLine).join(", ")}`,
      );
    const samples = resample(line);
    let heights: number[] | null = null;
    if (CLIMBS)
      try {
        heights = fillGaps(await openTopoData.elevation(transport, samples));
      } catch (error) {
        console.log(`  Anstiege: keine Höhen (${(error as Error).message})`);
        incomplete = true;
      }
    if (heights) {
      const climbs = matchClimbs(climbsOf(samples, heights), passes, t, (p) =>
        p.ascents.flatMap((_, i) => {
          const l = routes[ascentKey(p.slug, i)];
          return l ? [l] : [];
        }),
      );
      const open = climbs.filter((c) => !c.named);
      console.log(
        `  Anstiege ab ${CLIMB_MIN_GAIN} Hm: ${climbs.length}, davon ${climbs.length - open.length} gelistet`,
      );
      for (const c of open)
        console.log(
          `    ${climbLine(c.climb)}${c.entry ? ` – Eintrag ${c.entry.slug}, nicht in passes` : " – kein Eintrag"}`,
        );
    }
    console.log();
  }
  console.log(
    `${transport.recorded} Anfragen (${transport.replayed} aus dem Cache)${incomplete ? " – unvollständig, siehe oben" : ""}`,
  );
  process.exit(incomplete ? 1 : 0);
}

console.log(
  `Abdeckung je Basis, Umkreis ${REACH_MAX_KM} km, Kandidaten ab ${FLOOR} m (--floor), ${selected.length} Orte, Overpass: ${new URL(OVERPASS_URL).host}\n`,
);

const rows: string[] = [];
const distinct = new Set<number>();
for (const t of selected) {
  let nodes: OverpassNode[];
  try {
    nodes = await nodesAround(t);
  } catch (error) {
    console.error(
      `${t.name}: Overpass antwortet nicht (${(error as Error).message}) – dieser Bericht braucht den Host; OVERPASS_URL=… wählt einen Spiegel`,
    );
    process.exit(1);
  }
  const cov = coverageOf(t, nodes, passes, FLOOR);
  for (const line of reportLines(t, cov, TOP)) console.log(line);
  console.log();
  const byFloor = Object.fromEntries(
    FLOORS.map((f) => [
      f,
      Object.values(coverageOf(t, nodes, passes, f).candidates).flat().length,
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
  `\n${selected.length} Orte, ${transport.recorded} Overpass-Anfragen (${transport.replayed} aus dem Cache), ${distinct.size} verschiedene Kandidaten ab ${FLOOR} m`,
);
