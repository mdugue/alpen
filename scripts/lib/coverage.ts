/**
 * Pure helpers for the coverage report (`scripts/analyze-coverage.ts`): which
 * OSM pass nodes around a base the data already lists, which are candidates,
 * and how they fall into the reach bands. No I/O – the script asks Overpass
 * and caches the answer, the tests feed hand-made nodes.
 *
 * "Listed" is decided by distance alone: a node within `MATCH_KM` of an entry's
 * marker is that entry, which is the gate's own "end of the route" limit
 * (`scripts/lib/validate.ts`). A node further away that carries an entry's
 * name is still a candidate, with the entry named next to it – that is either
 * a second saddle of the same name or a marker that sits on the wrong one,
 * and both are worth a look.
 */
import {
  REACH_BANDS,
  REACH_MAX_KM,
  bounds,
  haversine,
  reachBand,
} from "../../lib/geo";
import type { ReachBand } from "../../lib/geo";
import { DE } from "../../lib/i18n/dictionaries";
import { fold } from "../../lib/search";
import type { Pass } from "../../lib/types";
import type { OverpassNode } from "./hosts";
import { nameMatcher, taggedEle } from "./locate";

/** A node this close to a marker is that entry. */
export const MATCH_KM = 0.5;
/** Within this, a node with an entry's name is reported as "= that entry". */
export const NAME_KM = 6;
/** Two candidate nodes closer than this with the same name are one pass. */
export const DEDUPE_KM = 1;
/**
 * The elevation floors the report counts against: the lower one for the
 * foothills, where a 700 m col is a day's ride, the higher one inside the
 * Alps, where it is a hump in the valley road.
 */
export const FLOORS = [600, 1000] as const;

/**
 * Highway classes a pass road is expected to be, without `track` and
 * `service`: the report is a shortlist of roads worth a holiday, and a saddle
 * on a forest track is not one – `ROAD_HIGHWAYS` in `locate.ts` answers the
 * other question ("is there a road at all").
 */
export const PAVED_HIGHWAYS =
  "^(primary|secondary|tertiary|unclassified|residential)$";
/** `surface` values that say "not asphalt", when the tag is there at all. */
export const UNPAVED_SURFACES =
  "^(gravel|fine_gravel|unpaved|compacted|ground|dirt|earth|grass|sand|mud|rock|pebblestone|wood)$";

/**
 * Overpass: the pass and saddle nodes within `radiusKm` of a base that have a
 * paved road within `roadM`. The road check runs on the server – a 75 km
 * circle in the Alps holds hundreds of saddles, and asking for each one's
 * roads separately would be hundreds of requests.
 */
export const coverageQuery = (
  p: { lat: number; lon: number },
  radiusKm = REACH_MAX_KM,
  roadM = 300,
) => {
  const r = Math.round(radiusKm * 1000);
  return (
    `[out:json][timeout:180];(` +
    `node(around:${r},${p.lat},${p.lon})["mountain_pass"="yes"];` +
    `node(around:${r},${p.lat},${p.lon})["natural"="saddle"];` +
    `)->.p;` +
    `way(around.p:${roadM})["highway"~"${PAVED_HIGHWAYS}"]["surface"!~"${UNPAVED_SURFACES}"]->.r;` +
    `node.p(around.r:${roadM});out;`
  );
};

export interface CoverageNode {
  band: ReachBand;
  /** Distance from the base, km. */
  dist: number;
  ele: number | null;
  lat: number;
  lon: number;
  name: string | null;
  osm: number;
}

export interface Listed extends CoverageNode {
  slug: string;
}

export interface Candidate extends CoverageNode {
  /** An entry within `NAME_KM` that carries this node's name, if any. */
  near?: { slug: string; km: number };
}

export interface Coverage {
  /** Listed entries per band – counted per entry, not per node. */
  listed: Record<ReachBand, Listed[]>;
  candidates: Record<ReachBand, Candidate[]>;
  /** Nodes that carry no `ele` and are therefore not judged against a floor. */
  withoutEle: number;
  /** `pass` entries in reach with a single ascent. */
  singleSided: Pass[];
}

const emptyBands = <T>(): Record<ReachBand, T[]> => ({
  day: [],
  door: [],
  trip: [],
});

/**
 * The report for one base: every node against the entries. `floor` drops the
 * candidates below it; listed entries are never dropped – what the data has,
 * it has.
 */
export const coverageOf = (
  base: { lat: number; lon: number },
  nodes: readonly OverpassNode[],
  passes: readonly Pass[],
  floor: number,
): Coverage => {
  const inReach = passes
    .map((p) => ({ dist: haversine(base, p), p }))
    .filter((x) => x.dist <= REACH_MAX_KM);
  const matchers = inReach.map((x) => ({
    ...x,
    match: nameMatcher(x.p),
  }));

  const listedSlugs = new Set<string>();
  const listed = emptyBands<Listed>();
  const candidates = emptyBands<Candidate>();
  let withoutEle = 0;

  const seen: Candidate[] = [];
  for (const n of nodes) {
    const dist = haversine(base, n);
    const band = reachBand(dist);
    if (band === null) continue;
    const ele = taggedEle(n.tags);
    const name = n.tags?.name ?? null;
    const node: CoverageNode = {
      band,
      dist,
      ele,
      lat: n.lat,
      lon: n.lon,
      name,
      osm: n.id,
    };
    const owner = inReach.find((x) => haversine(x.p, n) <= MATCH_KM);
    if (owner) {
      const { slug } = owner.p;
      if (!listedSlugs.has(slug)) {
        listedSlugs.add(slug);
        listed[reachBand(owner.dist)!].push({ ...node, slug });
      }
      continue;
    }
    if (ele === null) {
      withoutEle += 1;
      continue;
    }
    if (ele < floor) continue;
    // One saddle is often two nodes (`mountain_pass` and `natural=saddle`),
    // a few metres apart and named alike.
    if (
      seen.some(
        (c) =>
          fold(c.name ?? "") === fold(name ?? "") &&
          haversine(c, n) <= DEDUPE_KM,
      )
    )
      continue;
    const [near] = matchers
      .filter((x) => x.match(n.tags) === 2 && haversine(x.p, n) <= NAME_KM)
      .map((x) => ({ km: haversine(x.p, n), slug: x.p.slug }))
      .toSorted((a, b) => a.km - b.km);
    const c: Candidate = near ? { ...node, near } : node;
    seen.push(c);
    candidates[band].push(c);
  }
  // Entries in reach whose marker no node matched still count as listed –
  // the toll roads and road summits without a saddle node.
  for (const x of inReach) {
    const { slug } = x.p;
    if (listedSlugs.has(slug)) continue;
    listedSlugs.add(slug);
    listed[reachBand(x.dist)!].push({
      band: reachBand(x.dist)!,
      dist: x.dist,
      ele: x.p.elevation,
      lat: x.p.lat,
      lon: x.p.lon,
      name: x.p.name,
      osm: 0,
      slug,
    });
  }
  for (const band of REACH_BANDS)
    candidates[band.key].sort((a, b) => (b.ele ?? 0) - (a.ele ?? 0));

  return {
    candidates,
    listed,
    singleSided: inReach
      .filter((x) => x.p.type === "pass" && x.p.ascents.length === 1)
      .map((x) => x.p),
    withoutEle,
  };
};

const fmtEle = (n: number | null) =>
  n === null ? "? m" : `${n.toLocaleString("de-DE")} m`;

/** "Passo di Verva 2 290 m (= passo-x, 1,2 km)" */
export const candidateLine = (c: Omit<Candidate, "band" | "dist">) =>
  `${c.name ?? `#${c.osm}`} ${fmtEle(c.ele)}${
    c.near
      ? ` (= ${c.near.slug}, ${c.near.km.toFixed(1).replace(".", ",")} km)`
      : ""
  }`;

/** The lines for one base, as the report prints them. */
export const reportLines = (
  town: { name: string; country: string },
  cov: Coverage,
  top: number,
): string[] => {
  const out = [`${town.name} (${town.country})`];
  for (const band of REACH_BANDS) {
    const l = cov.listed[band.key].length;
    const c = cov.candidates[band.key];
    const names = c.slice(0, top).map(candidateLine).join(", ");
    out.push(
      `  ${DE.vocab.band[band.key].label.padEnd(16)} gelistet ${String(l).padStart(3)}   Kandidaten ${String(c.length).padStart(3)}${
        names ? `   ${names}${c.length > top ? ", …" : ""}` : ""
      }`,
    );
  }
  if (cov.singleSided.length)
    out.push(
      `  einseitige Pässe im Umkreis: ${cov.singleSided.length} (${cov.singleSided
        .slice(0, top)
        .map((p) => p.name)
        .join(", ")}${cov.singleSided.length > top ? ", …" : ""})`,
    );
  if (cov.withoutEle)
    out.push(`  ohne Höhenangabe in OSM, nicht gezählt: ${cov.withoutEle}`);
  return out;
};

/** One line per base for the closing table, the thinnest day band first. */
export const summaryLine = (
  town: { name: string },
  cov: Coverage,
  byFloor: Record<number, number>,
) => {
  const n = (band: ReachBand) => String(cov.listed[band].length).padStart(4);
  const c = (band: ReachBand) =>
    String(cov.candidates[band].length).padStart(4);
  return (
    `${town.name.padEnd(26)}${n("door")}${n("day")}${n("trip")}   ${c("door")}${c("day")}${c("trip")}` +
    `   ${String(cov.singleSided.length).padStart(4)}   ${FLOORS.map((f) => String(byFloor[f] ?? 0).padStart(5)).join("")}`
  );
};

/**
 * A pass or saddle this close to a tour's stored line is one the tour rides
 * over. Wider than the gate's 500 m would be wrong here: a loop that passes a
 * saddle in the valley below it does not climb it.
 */
export const ON_ROUTE_KM = 0.3;
/**
 * Tours count from the lower floor: a 980 m saddle is a hump on a base's
 * map but a named climb of the day on a loop like the Dolomitenradrundfahrt
 * (the Gailbergsattel), and the tour is what a rider looks it up from.
 */
export const [TOUR_FLOOR] = FLOORS;

type Line = readonly (readonly [number, number])[];

/** Distance from a point to the nearest vertex of a `[lat, lon]` line, km. */
export const distanceToLine = (
  p: { lat: number; lon: number },
  line: Line,
): number => {
  let best = Infinity;
  for (const [lat, lon] of line) {
    // A degree of latitude is 111 km: whatever is further than the best so
    // far in latitude alone cannot be nearer.
    if (Math.abs(lat - p.lat) * 111 > best) continue;
    const d = haversine(p, { lat, lon });
    if (d < best) best = d;
  }
  return best;
};

/**
 * Overpass: the pass and saddle nodes in the box around a tour's line. No
 * road check on the server, unlike `coverageQuery`: the line is the road, and
 * which of the nodes it rides over is `tourCoverage`'s to decide – which also
 * keeps a box the size of the Route des Grandes Alpes inside a mirror's
 * timeout.
 */
export const tourQuery = (line: Line) => {
  const [w, s, e, n] = bounds(line);
  const pad = 0.01;
  const box = [s - pad, w - pad, n + pad, e + pad]
    .map((v) => v.toFixed(4))
    .join(",");
  return (
    `[out:json][timeout:180];(` +
    `node(${box})["mountain_pass"="yes"];` +
    `node(${box})["natural"="saddle"];` +
    `);out;`
  );
};

export interface TourCoverage {
  /** Entries the line rides over that the tour's `passes` do not name. */
  unnamed: Pass[];
  /** Nodes on the line above the floor that no entry stands for. */
  candidates: Omit<CoverageNode, "band" | "dist">[];
}

/**
 * What a tour rides over that the data does not say: entries on its line
 * missing from its `passes`, and saddles on its line that are no entry at
 * all. A tour's climbs are pass entries, or its strip, its status and its
 * reach know nothing about them – which is how the Dolomitenradrundfahrt
 * would come to cross three roads the app had never heard of.
 */
export const tourCoverage = (
  tour: { passes: readonly string[]; touches?: readonly string[] },
  line: Line,
  nodes: readonly OverpassNode[],
  passes: readonly Pass[],
  floor: number = TOUR_FLOOR,
): TourCoverage => {
  // What the tour names as touched is answered too: a junction, not a climb.
  const named = new Set([...tour.passes, ...(tour.touches ?? [])]);
  // Crossings only: a spur's top on the line is a stich the curator chose to
  // leave out (the warning on spurs says why), and a valley or a balcony
  // has its marker on the very road a loop rides along.
  const unnamed = passes.filter(
    (p) =>
      p.type === "pass" &&
      !named.has(p.slug) &&
      distanceToLine(p, line) <= ON_ROUTE_KM,
  );
  const candidates: TourCoverage["candidates"] = [];
  for (const n of nodes) {
    const ele = taggedEle(n.tags);
    if (ele === null || ele < floor) continue;
    if (passes.some((p) => haversine(p, n) <= MATCH_KM)) continue;
    if (distanceToLine(n, line) > ON_ROUTE_KM) continue;
    const name = n.tags?.name ?? null;
    if (
      candidates.some(
        (c) =>
          fold(c.name ?? "") === fold(name ?? "") &&
          haversine(c, n) <= DEDUPE_KM,
      )
    )
      continue;
    candidates.push({
      ele,
      lat: n.lat,
      lon: n.lon,
      name,
      osm: n.id,
    });
  }
  candidates.sort((a, b) => (b.ele ?? 0) - (a.ele ?? 0));
  return { candidates, unnamed };
};
