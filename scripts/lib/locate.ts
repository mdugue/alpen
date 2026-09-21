/**
 * Pure helpers for placing a pass coordinate on the road: distance from a
 * point to the nearest way, OSM pass-node candidates ranked against a pass,
 * and the queries and answer shapes of the two hosts that can supply them –
 * Overpass and the OSM map API, picked between in `osm.ts`. No I/O –
 * `build-data.ts` uses the road distance as a gate, `locate-pass.ts` uses
 * everything interactively, and the unit tests feed both the known-bad points.
 *
 * Why a road distance at all: the DEM check compares heights, and a
 * mountainside can happen to sit at pass height. The Großglockner point read
 * 2 535 m against a stated 2 571 m and passed – it was 1 km from the road.
 */
import { fold } from "../../lib/search";
import type { LatLon, Pass } from "../../lib/types";
import { haversine } from "./validate";

/**
 * Highway classes a pass road can be. `service` covers the car parks that end
 * summit roads (Mangart), `track` the gravel passes the data lists on purpose
 * (Finestre) – the question here is "is this a road at all", not "is it
 * asphalt".
 */
export const ROAD_HIGHWAYS =
  "^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track)$";
/** Search radius for the nearest road, km. Beyond it the point is simply off. */
export const ROAD_RADIUS = 0.3;
/** Search radius for OSM pass nodes around a suspect point, km. */
export const CANDIDATE_RADIUS = 6;

/**
 * A POST to Overpass. The Apache in front of overpass-api.de answers a bare
 * `fetch` with 406 before the query is ever parsed – it wants the form
 * content type and a User-Agent it recognises as a client rather than a
 * runtime default. Both call sites go through here so they cannot drift.
 */
export const overpassPost = (query: string): RequestInit => ({
  body: `data=${encodeURIComponent(query)}`,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "alpen-data/1.0 (https://github.com/mdugue/alpen)",
  },
  method: "POST",
});

/** Overpass `out geom` way: the node coordinates come inline. */
export interface OverpassWay {
  geometry: { lat: number; lon: number }[];
  id: number;
  tags?: Record<string, string>;
  type: "way";
}
export interface OverpassNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  type: "node";
}

/**
 * Distance in km from a point to a segment, on a local flat projection – the
 * segments are metres to a few hundred metres long, so the error is nil.
 */
const toSegment = (p: LatLon, a: LatLon, b: LatLon) => {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const ax = (a.lon - p.lon) * k;
  const ay = a.lat - p.lat;
  const bx = (b.lon - p.lon) * k;
  const by = b.lat - p.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(x, y) * 111.32;
};

/** Distance in km from a point to the nearest point of any of the ways. */
export const distanceToWays = (p: LatLon, ways: OverpassWay[]) => {
  let best = Infinity;
  for (const w of ways)
    for (let i = 1; i < w.geometry.length; i += 1) {
      const d = toSegment(p, w.geometry[i - 1]!, w.geometry[i]!);
      if (d < best) best = d;
    }
  return best;
};

/**
 * Overpass query for the drivable ways around each point, one request for a
 * batch. The result is judged locally with `distanceToWays`, so the radius
 * only has to be large enough that "nothing found" means "off the road".
 */
export const roadsQuery = (points: LatLon[], radiusKm = ROAD_RADIUS) =>
  `[out:json][timeout:60];(${points
    .map(
      (p) =>
        `way(around:${Math.round(radiusKm * 1000)},${p.lat},${p.lon})["highway"~"${ROAD_HIGHWAYS}"];`,
    )
    .join("")});out geom;`;

/** Overpass query for pass and saddle nodes around a point. */
export const candidatesQuery = (p: LatLon, radiusKm = CANDIDATE_RADIUS) => {
  const r = Math.round(radiusKm * 1000);
  return (
    `[out:json][timeout:60];(` +
    `node(around:${r},${p.lat},${p.lon})["mountain_pass"="yes"];` +
    `node(around:${r},${p.lat},${p.lon})["natural"="saddle"];` +
    `);out;`
  );
};

export interface Candidate {
  dist: number;
  /** OSM `ele` tag in m, if the node has one. */
  ele: number | null;
  lat: number;
  lon: number;
  name: string | null;
  /** 2 = the node carries the pass's name or an alias, 1 = a word of it, 0 = none. */
  nameMatch: 0 | 1 | 2;
  osm: number;
}

const words = (s: string) =>
  fold(s)
    .split(" ")
    .filter((w) => w.length > 3);

/** The OSM `ele` tag as a rounded number; "2503,6" occurs too. */
export const taggedEle = (tags: Record<string, string> = {}) => {
  const n = Number((tags.ele ?? "").replace(",", "."));
  return tags.ele && Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * OSM nodes as candidates for a pass, best first: by name match, then by how
 * close the tagged elevation is to the curated one, then by distance. A node
 * without a name or elevation still ranks – toll-road high points rarely have
 * either – it just ranks behind one that has both.
 */
/**
 * How well an OSM element's names match the pass: 2 for a name or alias, 1 for
 * a word of one, 0 for nothing. It reads every `name*` tag, because the Alps
 * are multilingual and the German name is rarely the only one. Shared by the
 * pass nodes and the roads: "Villacher Alpenstraße" is how a summit road says
 * which pass it belongs to.
 */
export const nameMatcher = (
  pass: Pick<Pass, "name" | "aliases">,
): ((tags?: Record<string, string>) => 0 | 1 | 2) => {
  const full = new Set([pass.name, ...(pass.aliases ?? [])].map(fold));
  const parts = new Set([pass.name, ...(pass.aliases ?? [])].flatMap(words));
  return (tags: Record<string, string> = {}) => {
    const names = Object.entries(tags)
      .filter(
        ([k]) => k === "name" || k.startsWith("name:") || k === "alt_name",
      )
      .map(([, v]) => v);
    if (names.some((n) => full.has(fold(n)))) return 2;
    if (names.some((n) => words(n).some((w) => parts.has(w)))) return 1;
    return 0;
  };
};

export const rankCandidates = (
  pass: Pick<Pass, "name" | "aliases" | "elevation" | "lat" | "lon">,
  nodes: OverpassNode[],
): Candidate[] => {
  const nameMatch = nameMatcher(pass);
  const eleGap = (c: Candidate) =>
    c.ele === null ? 9999 : Math.abs(c.ele - pass.elevation);
  return nodes
    .map((n): Candidate => ({
      dist: haversine([pass.lat, pass.lon], [n.lat, n.lon]),
      ele: taggedEle(n.tags),
      lat: n.lat,
      lon: n.lon,
      name: n.tags?.name ?? null,
      nameMatch: nameMatch(n.tags),
      osm: n.id,
    }))
    .toSorted(
      (a, b) =>
        b.nameMatch - a.nameMatch || eleGap(a) - eleGap(b) || a.dist - b.dist,
    );
};

// ── The same facts from the OSM map API ──────────────────────────────────────

/**
 * Overpass is one host, and when it is unreachable every pass coordinate in
 * the backlog is stuck behind it. The OSM map API answers a bounding box with
 * every element inside it instead of a query, which is the same two facts for
 * more bytes: the drivable ways under a point, and the pass nodes around it.
 *
 * The shapes differ in one place. `out geom` inlines a way's coordinates;
 * the map API sends node ids and the nodes separately. Both reach
 * `waysWithGeometry`, so the measuring path stays single – `distanceToWays`
 * never learns where its ways came from.
 */
export interface OsmMapWay {
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
  type: "way";
}
export type OsmElement = OverpassNode | OverpassWay | OsmMapWay;

const ROAD_RE = new RegExp(ROAD_HIGHWAYS, "u");
/** Is this a road at all – the same classes `roadsQuery` asks Overpass for. */
export const isRoad = (tags: Record<string, string> = {}) =>
  ROAD_RE.test(tags.highway ?? "");

/** The drivable ways of a batch of elements, coordinates resolved. */
export const waysWithGeometry = (elements: OsmElement[]): OverpassWay[] => {
  const nodes = new Map<number, { lat: number; lon: number }>();
  for (const e of elements)
    if (e.type === "node") nodes.set(e.id, { lat: e.lat, lon: e.lon });
  const out: OverpassWay[] = [];
  for (const e of elements) {
    if (e.type !== "way" || !isRoad(e.tags)) continue;
    const geometry =
      "geometry" in e
        ? e.geometry
        : e.nodes.map((id) => nodes.get(id)).filter((n) => n !== undefined);
    // A way whose nodes are cut off by the bbox edge keeps the part that is
    // inside it; with fewer than two it has no segment to measure against.
    if (geometry.length > 1)
      out.push({ geometry, id: e.id, tags: e.tags, type: "way" });
  }
  return out;
};

/**
 * The pass and saddle nodes of a bbox answer, cut back to the circle
 * `candidatesQuery` would have asked for – a box that contains the radius is
 * wider at its corners, and a candidate 8 km away must not rank as one at 6.
 */
export const passNodesWithin = (
  p: LatLon,
  radiusKm: number,
  elements: OsmElement[],
): OverpassNode[] =>
  elements.filter(
    (e): e is OverpassNode =>
      e.type === "node" &&
      (e.tags?.mountain_pass === "yes" || e.tags?.natural === "saddle") &&
      haversine([p.lat, p.lon], [e.lat, e.lon]) <= radiusKm,
  );

/** The map API's bbox, `minlon,minlat,maxlon,maxlat`, around a point. */
export const mapBbox = (p: LatLon, radiusKm: number) => {
  const dLat = radiusKm / 111.32;
  // Near the poles the cosine would blow the box up; in the Alps it is ~0.7.
  const dLon =
    radiusKm / (111.32 * Math.max(0.1, Math.cos((p.lat * Math.PI) / 180)));
  return [p.lon - dLon, p.lat - dLat, p.lon + dLon, p.lat + dLat]
    .map((n) => n.toFixed(5))
    .join(",");
};
