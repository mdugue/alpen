/**
 * Pure helpers for the detour report (`scripts/analyze-branches.ts`): which
 * paved dead ends leave a stored route and climb, the candidates for a
 * `branchOf` spur like the Edelweißspitze off the Großglockner. No I/O – the
 * script asks Overpass and Open-Meteo and caches the answers, the tests feed
 * hand-made elements.
 *
 * A detour is read off the road graph, not off a tag – OSM has no "detour"
 * relation, and Wikidata none either:
 *
 * 1. The OSM nodes within `ON_ROUTE_M` of the stored route are the route.
 * 2. Every edge from a route node to a node off it opens a component of the
 *    graph without the route. A component that touches the route again more
 *    than `JUNCTION_SPREAD_KM` away is a parallel road or a loop, and one
 *    that reaches the edge of the box asked for leads somewhere else – both
 *    are roads, not detours. What remains ends somewhere: a dead end.
 * 3. Its ends (nodes of degree one) are measured from the junction along the
 *    road; the script asks the DEM for their heights and `rankBranches`
 *    keeps the end that climbs most.
 *
 * The human decides; nothing here becomes data. Village streets that climb
 * to a farm pass the graph test as well as the Edelweißstraße does, which is
 * why the report carries the name of what lies at the end.
 */
import { haversine } from "../../lib/geo";
import type { LatLon, Pass } from "../../lib/types";
import type { OsmElement } from "./hosts";

/** Highway classes a detour can be: the coverage report's plus paved `service`. */
export const BRANCH_HIGHWAYS =
  "^(primary|secondary|tertiary|unclassified|residential)$";
/** `surface` values that say "not asphalt", when the tag is there at all. */
export const UNPAVED_SURFACES =
  "^(gravel|fine_gravel|unpaved|compacted|ground|dirt|earth|grass|sand|mud|rock|pebblestone|wood)$";
/** A `service` road counts only where it says it is paved: most are car parks. */
const PAVED_SERVICE =
  "^(asphalt|paved|concrete|sett|paving_stones|cobblestone)$";
/** What a detour may end at, as `key=value` pairs; the name in the report. */
const TARGETS =
  "^(viewpoint|peak|alpine_hut|wilderness_hut|restaurant|attraction|memorial|hotel|parking|chapel|glacier|lake|reservoir)$";

/** An OSM node this close to the stored route is the route. */
export const ON_ROUTE_M = 25;
/** Contacts of one component with the route further apart than this make it a road, not a detour. */
export const JUNCTION_SPREAD_KM = 0.4;
/** A component with a node this close to the box's edge leads out of it. */
export const EDGE_KM = 0.3;
/** The box around a route: wide enough to hold the Kaiser-Franz-Josefs-Höhe, 5 km off its junction. */
export const MARGIN_KM = 7;
/** Ends of one component that are measured; the furthest along the road. */
export const MAX_ENDS = 12;
/** An end this close to an entry's marker is that entry. */
export const LISTED_KM = 0.5;

export interface Box {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/** The box around some routes, `marginKm` wider on every side. */
export const boxAround = (
  routes: [number, number][][],
  marginKm = MARGIN_KM,
): Box => {
  const pts = routes.flat();
  const lat = pts.map((p) => p[0]);
  const lon = pts.map((p) => p[1]);
  const midLat = (Math.min(...lat) + Math.max(...lat)) / 2;
  const dLat = marginKm / 111.2;
  const dLon = marginKm / (111.2 * Math.cos((midLat * Math.PI) / 180));
  return {
    maxLat: Math.max(...lat) + dLat,
    maxLon: Math.max(...lon) + dLon,
    minLat: Math.min(...lat) - dLat,
    minLon: Math.min(...lon) - dLon,
  };
};

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Overpass: the paved ways in the box with their nodes, and the named places
 * a detour may end at. `out body` on the ways keeps the node ids, which the
 * graph needs and `out geom` would drop.
 */
export const branchQuery = (b: Box) => {
  const bbox = [b.minLat, b.minLon, b.maxLat, b.maxLon].map(round).join(",");
  return (
    `[out:json][timeout:180][bbox:${bbox}];(` +
    `way["highway"~"${BRANCH_HIGHWAYS}"]["surface"!~"${UNPAVED_SURFACES}"]["access"!~"^(no|private)$"]["bicycle"!="no"];` +
    `way["highway"="service"]["surface"~"${PAVED_SERVICE}"]["access"!~"^(no|private)$"]["bicycle"!="no"];` +
    `)->.w;.w out body;node(w.w);out skel qt;` +
    `node[~"^(tourism|natural|amenity|historic|building)$"~"${TARGETS}"]["name"];out qt;`
  );
};

/** One dead end off a route, before the DEM has been asked. */
export interface Branch {
  /** Where it leaves the route. */
  junction: LatLon;
  /** Its ends, each with the distance from the junction along the road, km. */
  ends: (LatLon & { km: number; name: string | null })[];
}

interface Graph {
  at: Map<number, LatLon>;
  next: Map<number, { id: number; km: number; name: string | null }[]>;
}

const graphOf = (elements: OsmElement[]): Graph => {
  const at = new Map<number, LatLon>();
  for (const e of elements)
    if (e.type === "node") at.set(e.id, { lat: e.lat, lon: e.lon });
  const next: Graph["next"] = new Map();
  const link = (a: number, b: number, km: number, name: string | null) => {
    const list = next.get(a) ?? [];
    list.push({ id: b, km, name });
    next.set(a, list);
  };
  for (const e of elements) {
    if (e.type !== "way" || !("nodes" in e)) continue;
    const name = e.tags?.name ?? null;
    for (let i = 1; i < e.nodes.length; i += 1) {
      const a = e.nodes[i - 1]!;
      const b = e.nodes[i]!;
      const pa = at.get(a);
      const pb = at.get(b);
      if (!pa || !pb) continue;
      const km = haversine(pa, pb);
      link(a, b, km, name);
      link(b, a, km, name);
    }
  }
  return { at, next };
};

/** Distance from a point to the route in metres, on a local flat projection. */
const routeDistance = (route: [number, number][]) => {
  const k = Math.cos(((route[0]?.[0] ?? 46) * Math.PI) / 180);
  const xy = route.map(
    ([lat, lon]) => [lon * k * 111_200, lat * 111_200] as const,
  );
  return (p: LatLon) => {
    const px = p.lon * k * 111_200;
    const py = p.lat * 111_200;
    let best = Infinity;
    for (let i = 1; i < xy.length; i += 1) {
      const [ax, ay] = xy[i - 1]!;
      const [bx, by] = xy[i]!;
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len
        ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len))
        : 0;
      best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
    return best;
  };
};

const inside = (b: Box, p: LatLon, marginKm: number) => {
  const dLat = marginKm / 111.2;
  const dLon = marginKm / (111.2 * Math.cos((p.lat * Math.PI) / 180));
  return (
    p.lat > b.minLat + dLat &&
    p.lat < b.maxLat - dLat &&
    p.lon > b.minLon + dLon &&
    p.lon < b.maxLon - dLon
  );
};

/** The component off the route that `first` belongs to, and every route node it touches. */
const componentOf = (
  g: Graph,
  onRoute: Set<number>,
  r: number,
  first: number,
) => {
  const component = new Set<number>([first]);
  const contacts = new Set<number>([r]);
  const stack = [first];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of g.next.get(id) ?? []) {
      if (onRoute.has(n.id)) contacts.add(n.id);
      else if (!component.has(n.id)) {
        component.add(n.id);
        stack.push(n.id);
      }
    }
  }
  return { component, contacts };
};

/** The ends of a component, measured from the junction along the road (Dijkstra, small graphs). */
const endsOf = (
  g: Graph,
  component: Set<number>,
  r: number,
): Branch["ends"] => {
  const dist = new Map<number, number>([[r, 0]]);
  const name = new Map<number, string | null>();
  const queue = [r];
  while (queue.length) {
    queue.sort((x, y) => dist.get(y)! - dist.get(x)!);
    const id = queue.pop()!;
    for (const n of g.next.get(id) ?? []) {
      if (!component.has(n.id)) continue;
      const d = dist.get(id)! + n.km;
      if (d < (dist.get(n.id) ?? Infinity)) {
        dist.set(n.id, d);
        name.set(n.id, n.name ?? name.get(id) ?? null);
        queue.push(n.id);
      }
    }
  }
  return [...component]
    .filter((id) => (g.next.get(id)?.length ?? 0) === 1 && dist.has(id))
    .map((id) => ({
      ...g.at.get(id)!,
      km: dist.get(id)!,
      name: name.get(id) ?? null,
    }))
    .toSorted((x, y) => y.km - x.km)
    .slice(0, MAX_ENDS);
};

/** The dead ends that leave these routes inside the box, one per component. */
export const branchesOf = (
  routes: [number, number][][],
  elements: OsmElement[],
  box: Box,
): Branch[] => {
  const g = graphOf(elements);
  const near = routes.map(routeDistance);
  const onRoute = new Set<number>();
  for (const [id, p] of g.at)
    if (g.next.has(id) && near.some((d) => d(p) <= ON_ROUTE_M)) onRoute.add(id);

  const seen = new Set<number>();
  const out: Branch[] = [];
  for (const r of onRoute)
    for (const first of g.next.get(r) ?? []) {
      if (onRoute.has(first.id) || seen.has(first.id)) continue;
      const { component, contacts } = componentOf(g, onRoute, r, first.id);
      for (const id of component) seen.add(id);
      // Touching the route twice, far apart, is a parallel road or a loop;
      // reaching the box's edge is a road that leads somewhere else.
      const touch = [...contacts].map((id) => g.at.get(id)!);
      const spread = Math.max(
        ...touch.flatMap((a) => touch.map((b) => haversine(a, b))),
      );
      if (spread > JUNCTION_SPREAD_KM) continue;
      if ([...component].some((id) => !inside(box, g.at.get(id)!, EDGE_KM)))
        continue;
      const ends = endsOf(g, component, r);
      if (ends.length) out.push({ ends, junction: g.at.get(r)! });
    }
  return out;
};

/** What the report prints for one detour. */
export interface Candidate {
  junction: LatLon & { ele: number };
  end: LatLon & { ele: number; km: number };
  gain: number;
  /** The road's own name, or the nearest named place at its end. */
  name: string | null;
  /** The entry whose marker the end is, when it is one already. */
  listed: string | null;
}

/**
 * The end of each branch that climbs most, kept when it climbs at least
 * `minGain` metres within `maxKm` – then sorted by what it climbs.
 */
export const rankBranches = (
  branches: Branch[],
  /** The DEM height of a point, as the script fetched it. */
  ele: (p: LatLon) => number | undefined,
  places: { lat: number; lon: number; name: string }[],
  passes: Pass[],
  { minGain = 120, maxKm = 15 } = {},
): Candidate[] => {
  const out: Candidate[] = [];
  for (const b of branches) {
    const base = ele(b.junction);
    if (base === undefined) continue;
    let best: Candidate["end"] | null = null;
    let road: string | null = null;
    for (const e of b.ends) {
      const h = ele(e);
      if (h === undefined || e.km > maxKm) continue;
      if (!best || h > best.ele) {
        best = { ele: h, km: e.km, lat: e.lat, lon: e.lon };
        road = e.name;
      }
    }
    if (!best || best.ele - base < minGain) continue;
    const end = best;
    const place = places
      .map((p) => ({ d: haversine(p, end), name: p.name }))
      .filter((p) => p.d <= 0.3)
      .toSorted((x, y) => x.d - y.d);
    const listed =
      passes.find((p) => haversine(p, end) <= LISTED_KM)?.slug ?? null;
    out.push({
      end,
      gain: Math.round(end.ele - base),
      junction: { ...b.junction, ele: base },
      listed,
      name: place[0]?.name ?? road,
    });
  }
  return out.toSorted((a, b) => b.gain - a.gain);
};
