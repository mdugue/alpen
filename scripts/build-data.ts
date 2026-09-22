#!/usr/bin/env bun
/**
 * Precomputation of all static data.
 *
 *   bun run data:build                   # OSRM demo (car profile)
 *   ORS_KEY=… bun run data:build         # OpenRouteService, road-cycling profile
 *   bun run data:build --status          # report what is missing and what it costs
 *   bun run data:build --pending         # the same as a single number, for scripts
 *   bun run data:build --retry-rejected  # try the rejected keys again
 *   bun run data:build --only <text>     # restrict the run to keys containing it
 *   bun run data:build --format          # only rewrite data/generated/*.json canonically
 *
 * Writes to data/generated/. Intermediate state is saved after every step;
 * the run can be aborted and resumes. Results belong in the repo – nothing
 * is fetched at runtime.
 *
 * Three steps, in one shape. `plan` (scripts/lib/decide.ts) decides from the
 * curated data and what is already stored which jobs exist and what each one
 * needs; the pipelines below execute them through the hosts; `afterGate` turns
 * each verdict into the records that follow from it, and those are written.
 * Every rule about *when* something is fetched is in that one module, pure and
 * table-tested, and `data:check` reads the same plan – so what it tells the
 * curator about a key is what this script will do with it.
 *
 * What a stored route was fetched for is recorded with it: `meta.inputs` is the
 * hash of the ascent's start, its marker and elevation and its `check`
 * (`ascentInputs`). Move a coordinate and the hash no longer matches, so the
 * route is as pending as a missing one – before that, a moved marker left the
 * old geometry in place and only `data:check` noticed, as an error no command
 * could clear. The retry rule that follows from it is written down once, in
 * docs/data-pipeline.md.
 *
 * OSM is asked through scripts/lib/osm.ts, which falls back from Overpass to
 * the OSM map API when that host is unreachable – the pass points, and the 27
 * ascents that wait behind them, must not depend on one server.
 *
 * The route quality gate (scripts/lib/validate.ts) sits between the router and
 * the store: a geometry is measured, judged, and only then written. What fails
 * lands in rejected.json with its measured values instead of in routes.json, so
 * a wrong route neither reaches the map nor spends 100 Open-Meteo calls on a
 * useless profile. routes-meta.json records which router produced each route;
 * an OSRM route is re-fetched once an ORS key is available (--upgrade-osrm).
 *
 * The DEM height at the pass point is fetched first and gates the ascents of
 * that pass: a point that is 300 m off in height is not on the road, and every
 * route to it ends short and every profile paid for it is wasted.
 *
 * Every request goes through scripts/lib/transport.ts – the pacing, the
 * per-run budget (OPEN_METEO_BUDGET), Retry-After and the words that say a
 * quota is spent are written down there, once, for every host – and the
 * questions themselves are the functions of scripts/lib/hosts.ts. What the
 * budget did not reach is picked up by the next run
 * (.github/workflows/refresh-data.yml runs on a push to data/*.json;
 * scripts/backfill.sh drains a larger backlog in hourly batches, which is what
 * keeps a day inside Open-Meteo's 10 000 daily calls).
 */
import { mkdir } from "node:fs/promises";

import {
  PROFILE_POINTS,
  profileCoords,
  profileDistances,
  profileStats,
  withRoadDistances,
} from "../lib/profile";
import type { DataFileName } from "../lib/schema";
import type {
  AscentMetrics,
  ElevationProfile,
  LatLon,
  Pass,
  RouteGeometry,
  RouteSource,
  Summit,
} from "../lib/types";
import { bucketClimate } from "./lib/climate";
import { readData, writeData } from "./lib/data-files";
import {
  afterDecline,
  afterGate,
  judge,
  measure,
  ofRoad,
  plan,
  storedFor,
} from "./lib/decide";
import type { Flags, Judged, RouteJob, Stored } from "./lib/decide";
import { CLIMATE_WEIGHT, ORS_KEY, openMeteo, ors, osrm } from "./lib/hosts";
import { distanceToWays, ROAD_RADIUS } from "./lib/locate";
import { osmSource } from "./lib/osm";
import { HttpError, liveTransport, QuotaExhaustedError } from "./lib/transport";
import { geometryHash, withProfile } from "./lib/validate";

const STATUS_ONLY = process.argv.includes("--status");
const PENDING_ONLY = process.argv.includes("--pending");
const FORMAT_ONLY = process.argv.includes("--format");
const UPGRADE_OSRM = process.argv.includes("--upgrade-osrm");
const flags: Flags = {
  only: process.argv.includes("--only")
    ? (process.argv[process.argv.indexOf("--only") + 1] ?? "")
    : undefined,
  ors: ORS_KEY !== "",
  retryRejected: process.argv.includes("--retry-rejected"),
  upgradeOsrm: UPGRADE_OSRM,
};
const TODAY = new Date().toISOString().slice(0, 10);
/** Constructed here, asked nothing until a pipeline runs: --status stays offline. */
const transport = liveTransport();
const OPEN_METEO_BUDGET = transport.host("openMeteo").budget;
/** The binding Open-Meteo limit in practice: 5 000 calls/h ≈ 50 elevation profiles. */
const OPEN_METEO_HOURLY = 5000;
/**
 * What one profile costs, for the estimate below. Open-Meteo bills one call
 * per location and `openMeteo.elevation` charges exactly that, so this is the
 * cap `profileCoords` samples to – the estimate can only be an upper bound,
 * since a geometry with fewer points than the cap is cheaper.
 */
const PROFILE_WEIGHT = PROFILE_POINTS;

// ── The stored state, read once and validated ────────────────────────────────

const read = async <K extends DataFileName>(file: K) => {
  const { data, problems } = await readData(file);
  if (!data)
    throw new Error(`${file} ist unbrauchbar:\n  ${problems.join("\n  ")}`);
  for (const p of problems) console.warn(`WARN  ${p}`);
  return data;
};

await mkdir(new URL("../data/generated/", import.meta.url), {
  recursive: true,
});
const curated = {
  passes: await read("passes.json"),
  tours: await read("tours.json"),
};
const state: Stored = {
  climates: await read("generated/climate.json"),
  meta: await read("generated/routes-meta.json"),
  profiles: await read("generated/profiles.json"),
  rejected: await read("generated/rejected.json"),
  routes: await read("generated/routes.json"),
  summits: await read("generated/summits.json"),
};

/** Which file each part of the state lives in – the only place that pairing exists. */
const SAVE: Record<keyof Stored, (s: Stored) => Promise<void>> = {
  climates: (s) => writeData("generated/climate.json", s.climates),
  meta: (s) => writeData("generated/routes-meta.json", s.meta),
  profiles: (s) => writeData("generated/profiles.json", s.profiles),
  rejected: (s) => writeData("generated/rejected.json", s.rejected),
  routes: (s) => writeData("generated/routes.json", s.routes),
  summits: (s) => writeData("generated/summits.json", s.summits),
};

/**
 * Takes a decision into the state and onto disk. Writes are chained so two
 * concurrent pipelines never interleave a file write, and every file is
 * validated against its schema first (`writeData`): a malformed upstream
 * answer must never reach the repo.
 */
let writing: Promise<unknown> = Promise.resolve();
const commit = (next: Partial<Stored>) => {
  Object.assign(state, next);
  const parts = Object.keys(next) as (keyof Stored)[];
  writing = writing.then(async () => {
    for (const part of parts) await SAVE[part](state);
  });
  return writing;
};

// ── The hosts ────────────────────────────────────────────────────────────────

/**
 * ORS first, OSRM as the fallback – for the two reasons ORS legitimately has
 * no answer:
 *
 * - the daily quota is spent, and
 * - ORS refuses this geometry. Its road-cycling graph leaves out roads it does
 *   not consider fit for a road bike, and then answers 404: no route between
 *   the points (2009) or no routable point near one of them (2010). The URL is
 *   a constant, so a 404 here can only be the routing question, never a wrong
 *   address. Without this branch such a road is skipped on every run for ever –
 *   it is never stored, so nothing marks it as needing a retry.
 *
 * Both fall through to the car profile, and the gate judges what comes back the
 * same way it judges an ORS route: a car route that cuts a corner the road does
 * not take fails on length, on its end point or on where its summit lies. That
 * is how Finestre and Nivolet are on the map.
 */
const route = async (
  label: string,
  waypoints: LatLon[],
): Promise<{ declined: boolean; geom: RouteGeometry; source: RouteSource }> => {
  let declined = false;
  if (ORS_KEY && !transport.host("ors").exhausted) {
    try {
      return {
        declined,
        geom: await ors.route(transport, waypoints),
        source: "ors",
      };
    } catch (error) {
      if (error instanceof QuotaExhaustedError)
        console.log(
          `  ORS-Kontingent erschöpft: ${label} – weiter mit OSRM (Autoprofil), das Gate fängt die Ausreißer ab`,
        );
      else if (error instanceof HttpError && error.status === 404) {
        declined = true;
        console.log(
          `  ORS fährt diese Straße nicht: ${label} – weiter mit OSRM (Autoprofil), das Gate fängt die Ausreißer ab`,
        );
      } else throw error;
    }
  }
  return {
    declined,
    geom: await osrm.route(transport, waypoints),
    source: "osrm",
  };
};

/** DEM height at the pass coordinates themselves, to catch a wrong summit point. */
const summitElevations = async (
  list: Pass[],
): Promise<Record<string, Summit>> => {
  const elevation = await openMeteo.elevation(transport, list);
  const out: Record<string, Summit> = {};
  for (const [i, p] of list.entries())
    out[p.slug] = { dem: Math.round(elevation[i]!), lat: p.lat, lon: p.lon };
  return out;
};

const osm = osmSource({ log: (line) => console.log(line), transport });

/**
 * Distance from each pass point to the nearest drivable OSM way, one request
 * per batch of 25 (one per point while Overpass is out). The ways come back
 * with their geometry and the distance is measured locally; a point with no
 * way inside ROAD_RADIUS gets null.
 */
const roadDistances = async (
  list: Pass[],
): Promise<Record<string, number | null>> => {
  const out: Record<string, number | null> = {};
  for (let i = 0; i < list.length; i += 25) {
    const chunk = list.slice(i, i + 25);
    const ways = await osm.roads(chunk);
    for (const p of chunk) {
      const d = distanceToWays(p, ways);
      out[p.slug] = d <= ROAD_RADIUS ? +d.toFixed(3) : null;
    }
  }
  return out;
};

/** Elevations from the Copernicus DEM (Open-Meteo, no key needed). */
const profile = async (geom: RouteGeometry): Promise<ElevationProfile> => {
  const elevation = await openMeteo.elevation(
    transport,
    profileCoords(geom).map(([lat, lon]) => ({ lat, lon })),
  );

  // Elevation gain with 10 m smoothing, otherwise DEM noise adds up
  let gain = 0;
  let base = elevation[0]!;
  for (const e of elevation.slice(1)) {
    if (e - base >= 10) {
      gain += e - base;
      base = e;
    } else if (e < base) base = e;
  }
  // Distances follow the road, so profile.km agrees with the gate's
  // `ascentMetrics.km` instead of cutting every hairpin short.
  const dist = profileDistances(geom);
  const ele = elevation.map(Math.round);
  return {
    ...profileStats(dist, ele),
    dist,
    ele,
    elevationGain: Math.round(gain),
    start: ele[0]!,
    top: Math.max(...ele),
  };
};

// ── The three renderings of one plan ─────────────────────────────────────────

const report = () => {
  const { counts: c } = plan(curated, state, flags);
  const calls =
    c.newProfiles * PROFILE_WEIGHT + c.climate * CLIMATE_WEIGHT + c.summits;
  console.log(
    `Fehlend: ${c.routes} Routen, ${c.profiles} Profile, ${c.climate} Klimareihen, ${c.summits} Gipfelhöhen, ${c.roads} Straßenabstände${
      calls
        ? ` (≈ ${calls} Open-Meteo-Calls ≈ ${Math.ceil(calls / Math.min(OPEN_METEO_BUDGET, OPEN_METEO_HOURLY))} Läufe à ${OPEN_METEO_BUDGET})`
        : ""
    }${c.rejected ? ` · ${c.rejected} abgewiesen (rejected.json)` : ""}${
      c.stale ? ` · ${c.stale} veraltet (Koordinaten verschoben)` : ""
    }${
      c.upgradable && !UPGRADE_OSRM
        ? ` · ${c.upgradable} OSRM-Routen aufrüstbar (--upgrade-osrm)`
        : ""
    }${
      c.kept
        ? ` · ${c.kept} davon OSRM-Routen, deren ORS-Kandidat abgewiesen wurde`
        : ""
    }${
      c.blocked
        ? ` · ${c.blocked} Auffahrten warten auf eine korrigierte Passkoordinate (Höhe oder Straßenabstand)`
        : ""
    }`,
  );
};

if (PENDING_ONLY) {
  console.log(plan(curated, state, flags).counts.pending);
  process.exit(0);
}
if (STATUS_ONLY) {
  report();
  process.exit(0);
}
if (FORMAT_ONLY) {
  await commit(state);
  await writing;
  process.exit(0);
}

console.log(
  ORS_KEY
    ? `Routing über OpenRouteService (Rennrad-Profil), Fallback OSRM – ORS_KEY vorhanden (${ORS_KEY.length} Zeichen)`
    : "Routing über OSRM-Demo (Autoprofil) – ORS_KEY ist NICHT gesetzt, deshalb Autoprofil",
);
if (flags.retryRejected && Object.keys(state.rejected).length)
  console.log(
    `${Object.keys(state.rejected).length} abgewiesene Schlüssel werden erneut versucht`,
  );
report();

// ── The gate ─────────────────────────────────────────────────────────────────

const fail = (what: string, e: unknown) =>
  console.error(`  ${what} FEHLER ${(e as Error).message}`);

/**
 * Geometry checks, then – for ascents – the profile and its checks. A fresh
 * route is stored as soon as the geometry passes, so a run cut short by the
 * Open-Meteo budget keeps its (free) routing work; the profile checks of the
 * next run can still take it back out. An upgrade candidate replaces the
 * stored route only once both have passed – what it would replace is read
 * before anything is written (`storedFor`) and put back by `afterGate` if the
 * candidate fails.
 */
const gate = async (
  tag: string,
  job: RouteJob,
  geom: RouteGeometry,
  source: RouteSource,
  /** False when the geometry came out of routes.json and is only being judged. */
  fetched = true,
  /** ORS has no answer for this road; recorded so nothing asks again in vain. */
  orsDeclined = false,
  /**
   * The stored route was fetched for inputs that have since changed, so it is
   * not a route to fall back on: it is wrong for the question being asked. A
   * failing candidate therefore takes it with it rather than putting it back.
   */
  replace = false,
) => {
  const hash = geometryHash(geom);
  // A fetched candidate for a key that already has a route is an upgrade; the
  // stored route has passed the gate and must survive a failing candidate.
  const keep = storedFor(job, state, fetched, replace);
  // Both read before anything is written: the accept drops the rejection, and
  // a retry would then always pay for a profile it already has.
  const before = state.rejected[job.key];
  const unchanged = before?.hash === hash;
  const cachedProfile = unchanged ? before?.profile : undefined;
  const base = {
    cachedProfile,
    geom,
    hash,
    keep,
    orsDeclined,
    source,
    today: TODAY,
  };
  let m = measure(job, geom);

  const reject = async (reasons: string[], judged: Partial<Judged> = {}) => {
    await commit(
      afterGate(job, state, { ...base, metrics: m, reasons, ...judged }),
    );
    console.log(
      `${tag} Abgewiesen: ${job.label} (${source})${unchanged ? " – unveränderte Geometrie, die Koordinaten sind das Problem" : ""}${
        keep
          ? ` – die gespeicherte ${keep.meta?.source ?? "osrm"}-Route bleibt`
          : ""
      }\n${reasons.map((r) => `    ${r}`).join("\n")}`,
    );
  };
  const accepted = async () => {
    await commit(afterGate(job, state, { ...base, metrics: m, reasons: [] }));
    console.log(
      `${tag} Route: ${job.label} (${source}, ${(m as AscentMetrics).km} km)`,
    );
  };

  const bad = judge(job, m);
  if (bad.length) {
    await reject(bad);
    return;
  }

  // An OSRM route stored while an ORS key exists is provisional – the upgrade
  // pass will replace the geometry and the profile would have to be paid for
  // a second time. 100 Open-Meteo calls is far too much to spend on a road we
  // already know is the wrong one.
  const deferred = source === "osrm" && ORS_KEY !== "" && !before;
  if (!ofRoad(job) || deferred) {
    if (fetched) await accepted();
    if (deferred)
      console.log(
        `${tag} Profil aufgeschoben: ${job.label} (OSRM-Route, erst nach --upgrade-osrm)`,
      );
    return;
  }

  // A fresh route is stored before its profile is paid for, so a run cut short
  // by the Open-Meteo budget keeps its (free) routing work – and the accept
  // drops a profile that belonged to the geometry it replaced. An upgrade
  // candidate is not stored yet: until its profile has passed, the stored
  // route is the better of the two.
  if (fetched && !keep) await accepted();

  let prof: ElevationProfile;
  try {
    // The cache is only ever hit for an identical geometry, so the distances
    // can be re-derived from it rather than trusted as they were written.
    prof = cachedProfile
      ? withRoadDistances(cachedProfile, geom)
      : await profile(geom);
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError))
      fail(`${tag} Profil ${job.label}`, error);
    // The stored route stays; the profile or the upgrade follows in the next
    // run, which re-fetches the candidate for free.
    if (keep)
      console.log(
        `${tag} Aufrüstung verschoben: ${job.label} – die ${keep.meta?.source ?? "osrm"}-Route bleibt, bis das ORS-Profil bezahlt ist`,
      );
    return;
  }

  // A traverse has no summit the profile could be checked against – it is
  // judged on length and ends, which the geometry alone already decided.
  if (job.kind === "ascent") {
    m = withProfile(m as AscentMetrics, prof, job.marker.elevation);
    const badProfile = judge(job, m);
    if (badProfile.length) {
      await reject(badProfile, { profile: prof });
      return;
    }
  }
  if (keep) await accepted();
  await commit({ profiles: { ...state.profiles, [job.key]: prof } });
  console.log(
    `${tag} Profil: ${job.label} (${prof.km} km, ${prof.elevationGain} Hm, Gipfel ${prof.top} m)`,
  );
};

// ── The pipelines ────────────────────────────────────────────────────────────

// Pipeline 0: the pass points themselves – DEM height (Open-Meteo) and
// distance to the nearest road (Overpass), two cheap batches. They decide
// which ascents may be routed at all, so they run before everything else.
{
  const todo = plan(curated, state, flags).summits;
  if (todo.length)
    try {
      await commit({
        summits: { ...state.summits, ...(await summitElevations(todo)) },
      });
      console.log(`Gipfelhöhen: ${todo.length} gemessen`);
    } catch (error) {
      if (!(error instanceof QuotaExhaustedError)) fail("Gipfelhöhen", error);
    }
  // Read after the heights: a point that was just measured has no road
  // distance yet, so it joins the ones that predate the check.
  const { roads } = plan(curated, state, flags);
  if (roads.length)
    try {
      const dist = await roadDistances(roads);
      const summits = { ...state.summits };
      for (const p of roads)
        summits[p.slug] = {
          ...summits[p.slug]!,
          roadDist: dist[p.slug] ?? null,
        };
      await commit({ summits });
      console.log(`Straßenabstände: ${roads.length} gemessen`);
    } catch (error) {
      fail("Straßenabstände", error);
    }
  const measured = new Set([...todo, ...roads].map((p) => p.slug));
  for (const { finding, pass } of plan(curated, state, flags).findings)
    if (measured.has(pass.slug) && finding.reasons.some((r) => r.blocks))
      console.log(
        `${finding.words.marker} auffällig: ${pass.slug} – die ${finding.words.rides} werden nicht geroutet (bun run data:locate ${pass.slug})`,
      );
}

const todo = plan(curated, state, flags);

/** `[3/40]` against the pipeline's own total, dispatch order (not completion order). */
const counter = (total: number) => (i: number) => `[${i + 1}/${total}]`;

// Pipeline 1: routing. Each route runs through the gate and hands its profile on.
const routing = todo.routes
  .flatMap(({ job, verdict }) =>
    verdict.act === "fetch" || verdict.act === "retry"
      ? [{ job, replace: verdict.replace, upgrade: verdict.upgrade }]
      : [],
  )
  // A stale route is being replaced, not upgraded: its geometry answers a
  // question nobody asks any more, so "same source, nothing gained" does not
  // hold for it – which is what `replace` and `upgrade` say apart.
  .map(async ({ job, replace, upgrade }, i, all) => {
    const tag = counter(all.length)(i);
    try {
      const { declined, geom, source } = await route(job.label, job.waypoints);
      if (upgrade && (state.meta[job.key]?.source ?? "osrm") === source) {
        const next = afterDecline(job, state, declined);
        if (next) {
          await commit(next);
          if (declined)
            console.log(
              `${tag} ORS hat diese Straße endgültig abgelehnt: ${job.label} – die OSRM-Route bleibt, data:check verlangt keine Aufrüstung mehr`,
            );
        }
        return;
      }
      await gate(tag, job, geom, source, true, declined, replace);
    } catch (error) {
      if (!(error instanceof QuotaExhaustedError))
        fail(`${tag} Route ${job.label}`, error);
    }
  });

// Pipeline 2: profiles for routes that already exist and were never judged.
const profiling = todo.profiles
  .filter(({ verdict }) => verdict.act === "fetch")
  .map(({ job }, i, all) =>
    gate(
      counter(all.length)(i),
      job,
      state.routes[job.key]!,
      state.meta[job.key]?.source ?? "osrm",
      false,
    ),
  );

// Pipeline 4: climate. Queued after the (cheaper) profiles; the Open-Meteo budget cuts it off.
console.log(
  `Open-Meteo-Budget für diesen Lauf: ${OPEN_METEO_BUDGET} Calls (OPEN_METEO_BUDGET)`,
);
const climating = todo.climate.map(async (pass, i, all) => {
  const tag = counter(all.length)(i);
  try {
    const daily = await openMeteo.archive(transport, pass);
    await commit({
      climates: { ...state.climates, [pass.slug]: bucketClimate(daily) },
    });
    console.log(`${tag} Klima: ${pass.name}`);
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError))
      fail(`${tag} Klima ${pass.name}`, error);
  }
});

await Promise.all([...routing, ...profiling, ...climating]);
await writing;

const routerOrs = transport.host("ors");
const routerOsrm = transport.host("osrm");
const meteo = transport.host("openMeteo");
for (const lim of [routerOrs, routerOsrm, meteo]) {
  if (lim.exhausted)
    console.log(
      `${lim.name}: Kontingent erschöpft (${lim.exhausted}) – Rest im nächsten Lauf`,
    );
}
const osrmRoutes = Object.values(state.meta).filter(
  (x) => x.source === "osrm" && !x.orsDeclined,
).length;
const declinedRoutes = Object.values(state.meta).filter(
  (x) => x.orsDeclined,
).length;
console.log(
  `Fertig: ${Object.keys(state.routes).length} Routen, ${Object.keys(state.profiles).length} Profile, ` +
    `${Object.keys(state.climates).length} Klimareihen` +
    ` (${meteo.requests} Open-Meteo-Requests ≈ ${meteo.used} Calls)`,
);
// Split by router on purpose: a combined count cannot answer "did ORS run at
// all?", which is the first question when every stored route says osrm.
console.log(
  `Routing: ${routerOrs.requests} ORS-Requests, ${routerOsrm.requests} OSRM-Requests${
    ORS_KEY
      ? routerOrs.exhausted
        ? ` – ORS gestoppt: ${routerOrs.exhausted}`
        : routerOrs.requests
          ? ""
          : " – ORS war eingerichtet, wurde aber nie gebraucht (nichts zu routen?)"
      : " – ohne ORS_KEY, deshalb Autoprofil"
  }`,
);
if (osrmRoutes)
  console.log(
    `${osrmRoutes} Routen stammen vom OSRM-Autoprofil und sollten mit ORS_KEY erneuert werden`,
  );
if (declinedRoutes)
  console.log(
    `${declinedRoutes} Routen bleiben beim Autoprofil: ORS fährt diese Straßen nicht (--retry-rejected fragt erneut)`,
  );
report();
