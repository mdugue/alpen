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
 *   bun run data:locate col-des-champs --offline
 *                                             # without Overpass: DEM and the
 *                                             # route's highest point only
 *
 * Per pass it shows the stored point with its DEM height and its distance to
 * the nearest drivable road, then the OSM pass and saddle nodes within 6 km
 * ranked by name, elevation and distance, each with the DEM at the node and
 * its own road distance – and, when a route is stored, the highest sample of
 * that route as the fallback for toll and summit roads that have no pass node.
 * A pass marked `roadSummit` is not asked for a pass node at all; for it that
 * highest sample is the candidate, and `--apply` takes it.
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
  overpassPost,
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
/**
 * Without Overpass. The road distance then stays unmeasured – except for the
 * highest sample of a stored route, which came off the routed road itself and
 * is therefore on it by construction. That is exactly the candidate a
 * `roadSummit` needs, so `--offline --apply` is sound for those and refused
 * for everything else. Open-Meteo still supplies the DEM height.
 */
const OFFLINE = process.argv.includes("--offline");
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
  const res = await fetch(OVERPASS, overpassPost(query));
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
const ok = (b: boolean) => (b ? "✓" : "✗");
/** Distance to the nearest road with its verdict; `null` = not measured. */
const road = (x: { road: number | null; roadOk: boolean }) =>
  x.road === null
    ? "ungeprüft"
    : `${x.road <= ROAD_RADIUS ? m(x.road) : `> ${m(ROAD_RADIUS)}`} ${ok(x.roadOk)}`;

let applied = 0;
for (const p of list) {
  console.log(`\n${p.name} (${p.slug}) – angegeben ${p.elevation} m`);

  // Candidates from OSM, plus the highest sample of a stored route. A road
  // summit has no pass node by definition, so it is not asked for one.
  const ranked =
    p.roadSummit || OFFLINE
      ? []
      : rankCandidates(
          p,
          await overpass<OverpassNode>(candidatesQuery(p)),
        ).slice(0, 6);
  const fallback = highestSample(p);

  // One DEM request and one roads request for the point and every candidate.
  const points = [
    { lat: p.lat, lon: p.lon },
    ...ranked.map((c) => ({ lat: c.lat, lon: c.lon })),
    ...(fallback ? [{ lat: fallback.lat, lon: fallback.lon }] : []),
  ];
  const last = points.length - 1;
  const [heights, ways] = await Promise.all([
    dem(points),
    OFFLINE
      ? []
      : overpass<OverpassWay>(roadsQuery(points)).then((w) =>
          w.filter((x) => x.type === "way"),
        ),
  ]);
  const at = (i: number) => {
    // Offline the road is unknown, save for the route sample: it is a point of
    // the routed geometry, so its distance to the road is zero by definition.
    const onRoute = OFFLINE && fallback !== null && i === last;
    const dist = OFFLINE
      ? onRoute
        ? 0
        : null
      : distanceToWays(points[i]!, ways);
    return {
      dem: heights[i]!,
      demOk: checkSummit(heights[i]!, p.elevation).length === 0,
      road: dist,
      roadOk: dist !== null && dist <= LIMITS.summit.maxRoadDist,
    };
  };

  const cur = at(0);
  console.log(
    `  gespeichert  ${p.lat}, ${p.lon}   DEM ${cur.dem} m ${ok(cur.demOk)}   Straße ${road(cur)}`,
  );
  if (p.roadSummit)
    console.log(
      "  Straßenhöhepunkt (roadSummit): kein Passknoten in OSM, maßgeblich ist der höchste Punkt der Straße",
    );
  else if (OFFLINE)
    console.log(
      "  --offline: keine OSM-Kandidaten (Overpass wird übersprungen)",
    );
  else if (!ranked.length)
    console.log(
      `  kein mountain_pass/saddle-Knoten im Umkreis von ${CANDIDATE_RADIUS} km`,
    );
  for (const [i, c] of ranked.entries()) {
    const x = at(i + 1);
    console.log(
      `  ${String(i + 1).padStart(2)}. ${(c.name ?? "(ohne Namen)").padEnd(34)} ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}  ` +
        `${c.dist.toFixed(1)} km entfernt  ele ${c.ele ?? "–"}  DEM ${x.dem} m ${ok(x.demOk)}  Straße ${road(x)}  ` +
        `Name ${["–", "teilweise", "passt"][c.nameMatch]}  osm.org/node/${c.osm}`,
    );
  }
  if (fallback) {
    const x = at(last);
    console.log(
      `  höchster Punkt der gespeicherten Route ${fallback.key}: ${fallback.lat.toFixed(4)}, ${fallback.lon.toFixed(4)}  ` +
        `Profil ${fallback.ele} m  DEM ${x.dem} m ${ok(x.demOk)}  Straße ${OFFLINE ? "auf der Route ✓" : road(x)}  ` +
        `(${m(haversine([p.lat, p.lon], [fallback.lat, fallback.lon]))} vom Punkt)`,
    );
  }

  if (!APPLY) continue;
  if (p.roadSummit) {
    const x = fallback ? at(last) : null;
    if (!(fallback && x)) {
      console.log(
        "  --apply: keine gespeicherte Route, aus der sich der höchste Punkt lesen ließe – bitte von der Karte ablesen",
      );
      continue;
    }
    // No name to match against: a road summit is judged on height and road
    // alone, which is exactly what makes it the top of this road.
    if (!(x.demOk && x.roadOk)) {
      console.log(
        "  --apply: der höchste Routenpunkt hält die Grenzen nicht ein (DEM, Straße) – bitte von Hand entscheiden",
      );
      continue;
    }
    if (haversine([p.lat, p.lon], [fallback.lat, fallback.lon]) < 0.1) {
      console.log("  --apply: der gespeicherte Punkt liegt bereits dort");
      continue;
    }
    p.lat = +fallback.lat.toFixed(4);
    p.lon = +fallback.lon.toFixed(4);
    applied += 1;
    console.log(
      `  --apply: Passpunkt → ${p.lat}, ${p.lon} (höchster Punkt von ${fallback.key})`,
    );
    await Bun.sleep(1000);
    continue;
  }
  if (OFFLINE) {
    console.log(
      "  --apply: offline gibt es nur den höchsten Routenpunkt eines roadSummit – dieser Pass braucht Overpass",
    );
    continue;
  }
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
