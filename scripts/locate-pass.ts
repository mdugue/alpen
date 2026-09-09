#!/usr/bin/env bun
/**
 * Where does a pass point belong? For one pass, several, or every pass the
 * gate currently holds back, this prints what the data says about the stored
 * coordinate and what OSM offers instead – so a wrong point is fixed from
 * evidence rather than from a map screenshot.
 *
 *   bun run data:locate                       # every pass whose point is suspect
 *   bun run data:locate col-des-champs …      # these passes, suspect or not
 *   bun run data:locate col-des-champs --apply
 *                                             # write the best candidate to
 *                                             # data/passes.json, if it is safe
 *
 * Per pass it shows the stored point with its DEM height and its distance to
 * the nearest drivable road, then the OSM pass and saddle nodes within 6 km
 * ranked by name, elevation and distance, each with the DEM at the node and
 * its own road distance – and, when a route is stored, the highest sample of
 * that route as the fallback for toll and summit roads that have no pass node.
 *
 * `--apply` moves the point only when the best candidate is unambiguous: it
 * carries the pass's name (or an alias), its DEM height is within the summit
 * limit of the curated elevation and it sits on a road. Anything less is
 * printed for a human to decide. Afterwards `bun run data:build` re-measures
 * the point, routes the ascents and re-tries any rejection – nothing else to
 * remember.
 *
 * Needs the network (Overpass and Open-Meteo, no keys). A few requests per
 * pass; nothing here is worth a pacer beyond a short pause between passes.
 */
import passes from "../data/passes.json" with { type: "json" };
import { profileCoords } from "../lib/profile";
import type {
  ElevationProfile,
  Pass,
  RouteGeometry,
  Summit,
} from "../lib/types";
import {
  CANDIDATE_RADIUS,
  candidatesQuery,
  distanceToWays,
  ROAD_RADIUS,
  rankCandidates,
  roadsQuery,
} from "./lib/locate";
import type { Candidate, OverpassNode, OverpassWay } from "./lib/locate";
import { LIMITS, checkRoad, checkSummit, haversine } from "./lib/validate";

const OVERPASS =
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const GEN = new URL("../data/generated/", import.meta.url);
const APPLY = process.argv.includes("--apply");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const readJson = async <T>(name: string, fallback: T): Promise<T> => {
  const f = Bun.file(new URL(name, GEN));
  return (await f.exists()) ? ((await f.json()) as T) : fallback;
};
const summits = await readJson<Record<string, Summit>>("summits.json", {});
const routes = await readJson<Record<string, RouteGeometry>>("routes.json", {});
const profiles = await readJson<Record<string, ElevationProfile>>(
  "profiles.json",
  {},
);

const overpass = async <T>(query: string): Promise<T[]> => {
  const res = await fetch(OVERPASS, {
    body: `data=${encodeURIComponent(query)}`,
    method: "POST",
  });
  if (!res.ok) throw new Error(`Overpass ${res.status} ${await res.text()}`);
  return ((await res.json()) as { elements: T[] }).elements;
};
const dem = async (points: { lat: number; lon: number }[]) => {
  if (!points.length) return [];
  const res = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${points.map((p) => p.lat).join(",")}&longitude=${points.map((p) => p.lon).join(",")}`,
  );
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return ((await res.json()) as { elevation: number[] }).elevation.map((e) =>
    Math.round(e),
  );
};

interface Sample {
  ele: number;
  key: string;
  lat: number;
  lon: number;
}

/**
 * The highest profile sample of the pass's stored routes – the fallback
 * candidate for toll and summit roads that have no pass node in OSM.
 */
const highestSample = (p: Pass): Sample | null => {
  let best: Sample | null = null;
  for (const [i] of p.ascents.entries()) {
    const key = `${p.slug}:${i}`;
    const prof = profiles[key];
    const geom = routes[key];
    if (!(prof && geom)) continue;
    const coords = profileCoords(geom);
    for (const [j, ele] of prof.ele.entries()) {
      const c = coords[j];
      if (c && (!best || ele > best.ele))
        best = { ele, key, lat: c[0], lon: c[1] };
    }
  }
  return best;
};

/** The stored point is suspect when the gate holds it back or has not measured it yet. */
const suspect = (p: Pass) => {
  const s = summits[p.slug];
  if (!s || s.lat !== p.lat || s.lon !== p.lon) return true;
  return (
    checkSummit(s.dem, p.elevation).length > 0 ||
    checkRoad(s.roadDist).length > 0 ||
    s.roadDist === undefined
  );
};

const list = (passes as Pass[]).filter((p) =>
  wanted.length ? wanted.includes(p.slug) : suspect(p),
);
for (const w of wanted)
  if (!list.some((p) => p.slug === w)) console.error(`Unbekannter Slug: ${w}`);
if (!list.length) {
  console.log("Kein Passpunkt ist auffällig.");
  process.exit(0);
}

const m = (km: number) => `${Math.round(km * 1000)} m`;
const road = (d: number) => (d <= ROAD_RADIUS ? m(d) : `> ${m(ROAD_RADIUS)}`);
const ok = (b: boolean) => (b ? "✓" : "✗");

let applied = 0;
for (const p of list) {
  console.log(`\n${p.name} (${p.slug}) – angegeben ${p.elevation} m`);

  // Candidates from OSM, plus the highest sample of a stored route.
  const nodes = await overpass<OverpassNode>(candidatesQuery(p));
  const ranked = rankCandidates(p, nodes).slice(0, 6);
  const fallback = highestSample(p);

  // One DEM request and one roads request for the point and every candidate.
  const points = [
    { lat: p.lat, lon: p.lon },
    ...ranked.map((c) => ({ lat: c.lat, lon: c.lon })),
    ...(fallback ? [{ lat: fallback.lat, lon: fallback.lon }] : []),
  ];
  const [heights, ways] = await Promise.all([
    dem(points),
    overpass<OverpassWay>(roadsQuery(points)).then((w) =>
      w.filter((x) => x.type === "way"),
    ),
  ]);
  const at = (i: number) => ({
    dem: heights[i]!,
    demOk: checkSummit(heights[i]!, p.elevation).length === 0,
    road: distanceToWays(points[i]!, ways),
    roadOk: distanceToWays(points[i]!, ways) <= LIMITS.summit.maxRoadDist,
  });

  const cur = at(0);
  console.log(
    `  gespeichert  ${p.lat}, ${p.lon}   DEM ${cur.dem} m ${ok(cur.demOk)}   Straße ${road(cur.road)} ${ok(cur.roadOk)}`,
  );
  if (!ranked.length)
    console.log(
      `  kein mountain_pass/saddle-Knoten im Umkreis von ${CANDIDATE_RADIUS} km`,
    );
  for (const [i, c] of ranked.entries()) {
    const x = at(i + 1);
    console.log(
      `  ${String(i + 1).padStart(2)}. ${(c.name ?? "(ohne Namen)").padEnd(34)} ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}  ` +
        `${c.dist.toFixed(1)} km entfernt  ele ${c.ele ?? "–"}  DEM ${x.dem} m ${ok(x.demOk)}  Straße ${road(x.road)} ${ok(x.roadOk)}  ` +
        `Name ${["–", "teilweise", "passt"][c.nameMatch]}  osm.org/node/${c.osm}`,
    );
  }
  if (fallback) {
    const x = at(points.length - 1);
    console.log(
      `  höchster Punkt der gespeicherten Route ${fallback.key}: ${fallback.lat.toFixed(4)}, ${fallback.lon.toFixed(4)}  ` +
        `Profil ${fallback.ele} m  DEM ${x.dem} m ${ok(x.demOk)}  Straße ${road(x.road)} ${ok(x.roadOk)}  ` +
        `(${m(haversine([p.lat, p.lon], [fallback.lat, fallback.lon]))} vom Punkt)`,
    );
  }

  if (!APPLY) continue;
  const best: Candidate | undefined = ranked[0];
  const bx = best ? at(1) : null;
  if (!(best && bx) || best.nameMatch < 2 || !bx.demOk || !bx.roadOk) {
    console.log(
      "  --apply: kein eindeutiger Kandidat (Name muss passen, DEM innerhalb der Grenze, auf der Straße) – bitte von Hand entscheiden",
    );
    continue;
  }
  if (
    cur.demOk &&
    cur.roadOk &&
    haversine([p.lat, p.lon], [best.lat, best.lon]) < 0.1
  ) {
    console.log("  --apply: der gespeicherte Punkt liegt bereits dort");
    continue;
  }
  p.lat = +best.lat.toFixed(4);
  p.lon = +best.lon.toFixed(4);
  applied += 1;
  console.log(`  --apply: Passpunkt → ${p.lat}, ${p.lon} (${best.name})`);
  await Bun.sleep(1000);
}

if (applied) {
  await Bun.write(
    new URL("../data/passes.json", import.meta.url),
    `${JSON.stringify(passes, null, 1)}\n`,
  );
  console.log(
    `\n${applied} Passpunkt(e) in data/passes.json verschoben – jetzt: bun run data:build && bun run data:check`,
  );
}
