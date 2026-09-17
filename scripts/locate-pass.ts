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
 *                                             # without OSM: DEM and the
 *                                             # route's highest point only
 *
 * Per pass it shows the stored point with its DEM height and its distance to
 * the nearest drivable road, then the OSM pass and saddle nodes within 6 km
 * ranked by name, elevation and distance, each with the DEM at the node and
 * its own road distance – and, when a route is stored, the highest sample of
 * that route as the fallback for toll and summit roads that have no pass node.
 * A road summit – a `pass` marked `roadSummit`, and every `spur` – is not asked
 * for a pass node at all; for it that highest sample is the candidate, and
 * `--apply` takes it. Where even that is missing or fails its checks – no route
 * has been stored yet, or the stored one was routed to the wrong marker – the
 * road itself is measured: the drivable ways around the point, preferring the
 * one named after the pass, sampled for their heights (`roadTop`). That is the
 * last resort, and it is the one that gets a summit road out of its deadlock,
 * where the route waits for the coordinate and the coordinate was to come from
 * the route. A traverse type (`plateau`, `balcony`, `valley`) gets
 * neither: its marker is a curated point on a road that has no summit the ride
 * aims at, so there is no better candidate to propose and only the two
 * measurements are printed.
 *
 * `--apply` moves the point only when the best candidate is unambiguous: it
 * carries the pass's name (or an alias), its DEM height is within the summit
 * limit of the curated elevation and it sits on a road. Anything less is
 * printed for a human to decide. Afterwards `bun run data:build` re-measures
 * the point, routes the ascents and re-tries any rejection – nothing else to
 * remember.
 *
 * Needs the network (OSM and Open-Meteo, no keys). The OSM facts come from
 * Overpass, or – while that host is unreachable – from the OSM map API;
 * `scripts/lib/osm.ts` picks, says which, and either way it is a few requests
 * per pass, nothing worth a pacer beyond a short pause between them.
 */
import passes from "../data/passes.json" with { type: "json" };
import { profileCoords } from "../lib/profile";
import { hasRoadSummit, isTraverse, ROAD_TYPE } from "../lib/regions";
import type {
  ElevationProfile,
  Pass,
  RouteGeometry,
  Summit,
} from "../lib/types";
import {
  CANDIDATE_RADIUS,
  distanceToWays,
  nameMatcher,
  ROAD_RADIUS,
  rankCandidates,
} from "./lib/locate";
import type { Candidate } from "./lib/locate";
import { osmSource } from "./lib/osm";
import type { GetJson } from "./lib/osm";
import { LIMITS, checkRoad, checkSummit, haversine } from "./lib/validate";

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
const wanted = process.argv
  .slice(2)
  .filter((a, i) => !a.startsWith("--") && process.argv[i + 1] !== "--radius");

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

/** A refused answer's body – its text is what says *why* it was refused. */
const bodyOf = async (res: Response) => {
  try {
    return await res.text();
  } catch {
    return "";
  }
};

/**
 * Both OSM hosts answer JSON; a refusal carries its status and its body, which
 * is where "too many nodes" comes from. The pause in front is the whole pacing
 * this script needs: it works one pass at a time and never has more than two
 * requests in the air, one per host.
 */
const getJson: GetJson = async (url, init) => {
  await Bun.sleep(300);
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await bodyOf(res);
    throw new Error(`${new URL(url).host} ${res.status} ${body.slice(0, 120)}`);
  }
  return res.json();
};
const osm = osmSource({
  log: (line) => console.log(line),
  viaMap: getJson,
  viaOverpass: getJson,
});
/**
 * Open-Meteo bills one call per coordinate and allows 600 a minute, so a
 * request for 100 points has to be spaced ten seconds from the next one. This
 * script asks for hundreds of points per pass (`roadTop`), which is what
 * walked into a 429 before the pacer existed. The gap is kept here rather than
 * per request, because it is the *calls* that are billed, not the requests;
 * a 429 on top of that is waited out once, since the minute always passes.
 */
let nextDem = 0;
const dem = async (
  points: { lat: number; lon: number }[],
): Promise<number[]> => {
  if (!points.length) return [];
  const wait = nextDem - Date.now();
  if (wait > 0) await Bun.sleep(wait);
  nextDem = Date.now() + (points.length * 60_000) / 600;
  const res = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${points.map((p) => p.lat).join(",")}&longitude=${points.map((p) => p.lon).join(",")}`,
  );
  if (res.status === 429) {
    const body = await bodyOf(res);
    const reason = body.replaceAll(/\s+/gu, " ").slice(0, 120);
    // A minute passes on its own; an hour or a day does not, and sitting out
    // sixty of these would be an hour of pretending to work.
    if (/hourly|daily/iu.test(reason))
      throw new Error(
        `Open-Meteo: ${reason} – die Höhen dieses Laufs sind aufgebraucht, später weitermachen`,
      );
    console.log(`  Open-Meteo bremst (${reason}) – eine Minute warten …`);
    await Bun.sleep(60_000);
    return dem(points);
  }
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return ((await res.json()) as { elevation: number[] }).elevation.map((e) =>
    Math.round(e),
  );
};

interface Sample {
  ele: number;
  /** The heights were fetched here, not read from a stored profile. */
  fetched: boolean;
  key: string;
  lat: number;
  lon: number;
}

/**
 * The highest profile sample of the pass's stored routes – the fallback
 * candidate for toll and summit roads that have no pass node in OSM.
 *
 * A blocked road summit is usually the one that has no profile: the build
 * holds the profile back until the coordinate is right, and the coordinate is
 * what this sample is supposed to supply. So where a route is stored without
 * one, the heights are fetched here – one Open-Meteo request per ascent, for
 * the proposal only. Nothing is written: the build pays for the profile once,
 * on a geometry that was routed to the corrected marker.
 */
const highestSample = async (p: Pass): Promise<Sample | null> => {
  let best: Sample | null = null;
  for (const [i] of p.ascents.entries()) {
    const key = `${p.slug}:${i}`;
    const geom = routes[key];
    if (!geom) continue;
    const coords = profileCoords(geom);
    const stored = profiles[key]?.ele;
    // Offline there is nothing to fall back on, and a stored profile is free.
    if (!stored && OFFLINE) continue;
    const ele =
      stored ?? (await dem(coords.map(([lat, lon]) => ({ lat, lon }))));
    for (const [j, e] of ele.entries()) {
      const c = coords[j];
      if (c && (!best || e > best.ele))
        best = { ele: e, fetched: !stored, key, lat: c[0], lon: c[1] };
    }
  }
  return best;
};

/**
 * How far from the marker the top of its own road is looked for, km –
 * `--radius 8` widens it for a marker that sits kilometres from its road, at
 * the price of more tiles and more heights.
 */
const ROAD_TOP_RADIUS = Number(
  process.argv.includes("--radius")
    ? process.argv[process.argv.indexOf("--radius") + 1]
    : 5,
);
/**
 * …in tiles of this radius. The OSM map API refuses a box with more than
 * 50 000 nodes in it, and `osm.ts` answers that by halving – which would make
 * the search area quietly smaller than asked for, and the Kitzbüheler Horn's
 * summit sat outside the box that came back. A grid of boxes this size went
 * through everywhere it was tried, and Overpass, when it is up, answers the
 * whole grid in one query anyway.
 */
const TILE_RADIUS = 2;
/** One Open-Meteo elevation request carries this many coordinates. */
const DEM_BATCH = 100;

interface RoadTop {
  dem: number;
  lat: number;
  lon: number;
  /** Which road was measured – the reader has to be able to recognise it. */
  name: string;
  /** False when no way carried the pass's name and every road was searched. */
  named: boolean;
  /** How many of its points were asked for a height. */
  sampled: number;
}

/** Thins a list to at most `n`, evenly – and drops repeated coordinates first. */
const thin = <T extends { lat: number; lon: number }>(xs: T[], n: number) => {
  const seen = new Set<string>();
  const unique = xs.filter((x) => {
    const key = `${x.lat.toFixed(5)},${x.lon.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length <= n) return unique;
  const step = unique.length / n;
  return Array.from({ length: n }, (_, i) => unique[Math.floor(i * step)]!);
};

/**
 * The highest drivable point of the road around the marker – the last resort
 * for a summit road that OSM gives no pass node and that has no stored route
 * either, which is exactly the deadlock the blocked ones sit in: the route
 * waits for the coordinate, and the coordinate was supposed to come from the
 * route.
 *
 * The road says which one it is: a way named after the pass ("Villacher
 * Alpenstraße") is preferred, and only when none carries the name is every
 * drivable way in the radius searched – the printed name is then the first
 * thing to check. Two rounds of heights: a thinned sweep over the whole road
 * to find where the top is, then its 500 m neighbourhood to find where exactly.
 * 200 Open-Meteo calls per pass, and nothing is stored – this is a proposal,
 * the build pays for the real profile once the marker is right.
 */
const roadTop = async (p: Pass): Promise<RoadTop | null> => {
  // Tile centres 3 km apart: each box reaches 2 km, so they overlap and the
  // union has no hole. As many rings as the radius needs – nine tiles at 5 km,
  // twenty-five at 8.
  const step = 3 / 111.32;
  const lonStep = step / Math.max(0.1, Math.cos((p.lat * Math.PI) / 180));
  const rings = Math.max(1, Math.ceil((ROAD_TOP_RADIUS - TILE_RADIUS) / 3));
  const offsets = Array.from({ length: 2 * rings + 1 }, (_, i) => i - rings);
  const tiles = offsets.flatMap((dy) =>
    offsets.map((dx) => ({
      lat: p.lat + dy * step,
      lon: p.lon + dx * lonStep,
    })),
  );
  const ways = await osm.roads(tiles, TILE_RADIUS);
  const match = nameMatcher(p);
  const named = ways.filter((w) => match(w.tags) > 0);
  const pool = named.length ? named : ways;
  const points = pool
    .flatMap((w) =>
      w.geometry.map((c) => ({
        ...c,
        name: w.tags?.name ?? w.tags?.ref ?? "(ohne Namen)",
      })),
    )
    // The tiles are boxes and the search is a circle.
    .filter(
      (c) => haversine([p.lat, p.lon], [c.lat, c.lon]) <= ROAD_TOP_RADIUS,
    );
  if (!points.length) return null;

  let sampled = 0;
  const highest = async (xs: typeof points) => {
    const batch = thin(xs, DEM_BATCH);
    if (!batch.length) return null;
    sampled += batch.length;
    const ele = await dem(batch);
    let best = 0;
    for (const [i, e] of ele.entries()) if (e > ele[best]!) best = i;
    return { ...batch[best]!, dem: ele[best]! };
  };

  const sweep = await highest(points);
  if (!sweep) return null;
  const near = await highest(
    points.filter(
      (c) => haversine([sweep.lat, sweep.lon], [c.lat, c.lon]) <= 0.5,
    ),
  );
  const best = near && near.dem > sweep.dem ? near : sweep;
  return { ...best, named: named.length > 0, sampled };
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
    hasRoadSummit(p) || OFFLINE
      ? []
      : rankCandidates(p, await osm.passNodes(p)).slice(0, 6);
  // A traverse has no summit, so the route's highest sample means nothing there.
  const fallback = isTraverse(p.type) ? null : await highestSample(p);

  // One DEM request and one roads request for the point and every candidate.
  const points = [
    { lat: p.lat, lon: p.lon },
    ...ranked.map((c) => ({ lat: c.lat, lon: c.lon })),
    ...(fallback ? [{ lat: fallback.lat, lon: fallback.lon }] : []),
  ];
  const last = points.length - 1;
  const [heights, ways] = await Promise.all([
    dem(points),
    OFFLINE ? [] : osm.roads(points),
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

  // The road itself, but only where nothing better is on the table: a summit
  // road whose stored route has no usable high point, or none at all.
  const routeTop = fallback ? at(last) : null;
  const top =
    hasRoadSummit(p) && !OFFLINE && !(routeTop?.demOk && routeTop.roadOk)
      ? await roadTop(p)
      : null;
  const topOk = top !== null && checkSummit(top.dem, p.elevation).length === 0;

  const cur = at(0);
  console.log(
    `  gespeichert  ${p.lat}, ${p.lon}   DEM ${cur.dem} m ${ok(cur.demOk)}   Straße ${road(cur)}`,
  );
  if (isTraverse(p.type))
    console.log(
      `  ${ROAD_TYPE[p.type].label}: kein Gipfel, auf den die Fahrt zuläuft – der Punkt ist gesetzt, hier stehen nur seine Messwerte`,
    );
  else if (hasRoadSummit(p))
    console.log(
      "  Straßenhöhepunkt: kein Passknoten in OSM, maßgeblich ist der höchste Punkt der Straße",
    );
  else if (OFFLINE)
    console.log("  --offline: keine OSM-Kandidaten (OSM wird nicht gefragt)");
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
      `  höchster Punkt der gespeicherten Route ${fallback.key}${fallback.fetched ? " (Höhen eben abgefragt, kein Profil gespeichert)" : ""}: ${fallback.lat.toFixed(4)}, ${fallback.lon.toFixed(4)}  ` +
        `Profil ${fallback.ele} m  DEM ${x.dem} m ${ok(x.demOk)}  Straße ${OFFLINE ? "auf der Route ✓" : road(x)}  ` +
        `(${m(haversine([p.lat, p.lon], [fallback.lat, fallback.lon]))} vom Punkt)`,
    );
  }
  if (top)
    console.log(
      `  höchster Punkt der Straße "${top.name}"${top.named ? "" : " (kein Weg trägt den Passnamen – jede Straße im Umkreis gesucht)"}: ` +
        `${top.lat.toFixed(4)}, ${top.lon.toFixed(4)}  DEM ${top.dem} m ${ok(topOk)}  Straße 0 m ✓  ` +
        `(${m(haversine([p.lat, p.lon], [top.lat, top.lon]))} vom Punkt, ${top.sampled} Punkte im Umkreis von ${ROAD_TOP_RADIUS} km abgefragt)`,
    );

  if (!APPLY) continue;
  if (isTraverse(p.type)) {
    console.log(
      "  --apply: für eine Strecke ohne Gipfel gibt es keinen Kandidaten – der Punkt bleibt, wie er kuratiert wurde",
    );
    continue;
  }
  if (hasRoadSummit(p)) {
    // No name to match against: a road summit is judged on height and road
    // alone, which is exactly what makes it the top of this road. The stored
    // route's high point is the better of the two candidates – it came off a
    // road that was actually ridden to this marker – and the road's own top is
    // what is left when there is no route, or when the route's top fails.
    const best =
      fallback && routeTop?.demOk && routeTop.roadOk
        ? {
            lat: fallback.lat,
            lon: fallback.lon,
            why: `höchster Punkt von ${fallback.key}`,
          }
        : top && topOk
          ? {
              lat: top.lat,
              lon: top.lon,
              why: `höchster Punkt von "${top.name}"`,
            }
          : null;
    if (!best) {
      console.log(
        `  --apply: kein Kandidat hält die Grenzen ein${top ? ` (die Straße gipfelt bei ${top.dem} m, angegeben ${p.elevation} m)` : ""} – bitte von der Karte ablesen oder die angegebene Höhe prüfen`,
      );
      continue;
    }
    if (haversine([p.lat, p.lon], [best.lat, best.lon]) < 0.1) {
      console.log("  --apply: der gespeicherte Punkt liegt bereits dort");
      continue;
    }
    p.lat = +best.lat.toFixed(4);
    p.lon = +best.lon.toFixed(4);
    applied += 1;
    console.log(`  --apply: Passpunkt → ${p.lat}, ${p.lon} (${best.why})`);
    await Bun.sleep(1000);
    continue;
  }
  if (OFFLINE) {
    console.log(
      "  --apply: offline gibt es nur den höchsten Routenpunkt eines Straßenhöhepunkts – dieser Pass braucht die OSM-Knoten",
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

if (osm.fallback && !OFFLINE)
  console.log(
    `\nOSM-Antworten kamen aus der Karten-API, nicht von Overpass (${osm.fallback}).`,
  );
if (applied) {
  await Bun.write(
    new URL("../data/passes.json", import.meta.url),
    `${JSON.stringify(passes, null, 1)}\n`,
  );
  console.log(
    `\n${applied} Passpunkt(e) in data/passes.json verschoben – jetzt: bun run data:build && bun run data:check`,
  );
}
