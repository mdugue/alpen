#!/usr/bin/env bun
/**
 * Precomputation of all static data.
 *
 *   bun run data:build                   # OSRM demo (car profile)
 *   ORS_KEY=… bun run data:build         # OpenRouteService, road-cycling profile
 *   bun run data:build --status          # report what is missing and what it costs
 *   bun run data:build --pending         # the same as a single number, for scripts
 *   bun run data:build --retry-rejected  # try the rejected keys again
 *   bun run data:build --format          # only rewrite data/generated/*.json canonically
 *
 * Writes to data/generated/. Intermediate state is saved after every step;
 * the run can be aborted and resumes. Results belong in the repo – nothing
 * is fetched at runtime.
 *
 * The route quality gate (scripts/lib/validate.ts) sits between the router and
 * the store: a geometry is measured, judged, and only then written. What fails
 * lands in rejected.json with its measured values instead of in routes.json, so
 * a wrong route neither reaches the map nor spends 100 Open-Meteo calls on a
 * useless profile. routes-meta.json records which router produced each route;
 * an OSRM route is re-fetched once an ORS key is available.
 *
 * Rate limits. Every upstream host gets its own pacer; requests to one host are
 * sequential, the pipelines for different hosts (routing vs. Open-Meteo) run in
 * parallel. Open-Meteo bills weighted "calls", so the pacer spaces requests by
 * weight and a per-run budget stops the run before the hourly quota does.
 *
 *   OSRM demo      1 request/s, no key ("Do not exceed 1 request per second")
 *   ORS free       40 requests/min, 2 000/day; 403 "Quota exceeded" once spent
 *   Open-Meteo     600 calls/min, 5 000/h, 10 000/day per IP, shared by ALL
 *                  open-meteo.com hosts. 1 call = 1 location × ≤14 days × ≤10
 *                  variables. Observed: an elevation request with 100 points costs
 *                  ~100 calls, a 10-year daily climate request ~261 calls. The free
 *                  tier therefore fits ~40 profiles or ~19 climate series per hour.
 *
 * OPEN_METEO_BUDGET (default 4500) caps the weighted calls per run; what is left
 * over is picked up by the next run (.github/workflows/refresh-data.yml runs
 * twice a day, which uses ~9 000 of the 10 000 daily calls).
 *
 * A 429/403 whose body says the hour/day quota is spent stops that host for this
 * run – retrying would only burn the next window. A minutely 429 or a 5xx pauses
 * the host (Retry-After or 60 s) and retries.
 */
import { mkdir } from "node:fs/promises";

import passes from "../data/passes.json" with { type: "json" };
import tours from "../data/tours.json" with { type: "json" };
import { FILES } from "../lib/schema";
import type {
  AscentMetrics,
  ClimateYear,
  ElevationProfile,
  LatLon,
  Pass,
  RouteCheck,
  RouteGeometry,
  RouteMeta,
  RouteMetrics,
  RouteRejection,
  RouteSource,
  Tour,
  TourMetrics,
} from "../lib/types";
import {
  LIMITS,
  ascentMetrics,
  checkAscent,
  checkSummit,
  checkTour,
  geometryHash,
  haversine,
  tourMetrics,
  withProfile,
} from "./lib/validate";

const OUT = new URL("../data/generated/", import.meta.url);
const ORS = process.env.ORS_KEY ?? "";
const STATUS_ONLY = process.argv.includes("--status");
const PENDING_ONLY = process.argv.includes("--pending");
const FORMAT_ONLY = process.argv.includes("--format");
const RETRY_REJECTED = process.argv.includes("--retry-rejected");
const UPGRADE_OSRM = process.argv.includes("--upgrade-osrm");
/** Restrict the run to keys containing this, e.g. --only col-du-galibier. */
const ONLY = process.argv[process.argv.indexOf("--only") + 1];
const isOnly = (key: string) =>
  !process.argv.includes("--only") ||
  (ONLY !== undefined && key.includes(ONLY));
/** Point a local OSRM at this to cross-check ORS, see docs/plans/00-…md. */
const OSRM_HOST = process.env.OSRM_HOST ?? "https://router.project-osrm.org";
/**
 * How far ORS may snap a waypoint onto the road network. Deliberately the same
 * number as the gate's `maxStartDist`: the router is allowed to move a start
 * exactly as far as the gate still considers it the same start.
 */
const SNAP_RADIUS = LIMITS.ascent.maxStartDist;
const TODAY = new Date().toISOString().slice(0, 10);
const OPEN_METEO_BUDGET = Number(process.env.OPEN_METEO_BUDGET ?? 4500);
/** The binding limit in practice: 5 000 calls/h ≈ 50 elevation profiles. */
const OPEN_METEO_HOURLY = 5000;
const CLIMATE_FROM = "2015-01-01";
const CLIMATE_TO = "2024-12-31";
const PROFILE_POINTS = 100;
/** Open-Meteo weight of one climate request: one call per started 14-day period. */
const CLIMATE_WEIGHT = Math.ceil(
  (Date.parse(CLIMATE_TO) - Date.parse(CLIMATE_FROM)) / 86_400_000 / 14,
);
/** Open-Meteo weight of one elevation request: one call per location. */
const PROFILE_WEIGHT = PROFILE_POINTS;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson<T>(name: string, fallback: T): Promise<T> {
  const f = Bun.file(new URL(name, OUT));
  return (await f.exists()) ? ((await f.json()) as T) : fallback;
}
/**
 * One sorted key per line, compact value: a diff shows exactly which pass or
 * tour changed, without a fully indented routes.json of 100 000 lines.
 */
const format = (data: Record<string, unknown>) =>
  `{\n${Object.keys(data)
    .toSorted()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(data[k])}`)
    .join(",\n")}\n}\n`;
// Writes are chained so concurrent pipelines never interleave a file write.
// Every file is validated against its schema first: a malformed upstream
// answer must never reach the repo.
let writing: Promise<unknown> = Promise.resolve();
type Generated =
  | "routes.json"
  | "profiles.json"
  | "climate.json"
  | "routes-meta.json"
  | "rejected.json"
  | "summits.json";
const write = (name: Generated, data: Record<string, unknown>) =>
  (writing = writing.then(() => {
    const result = FILES[`generated/${name}`].safeParse(data);
    if (!result.success) {
      const [issue] = result.error.issues;
      throw new Error(
        `${name}: ${issue?.path.join(".")}: ${issue?.message} – nicht geschrieben`,
      );
    }
    return Bun.write(new URL(name, OUT), format(data));
  }));

// ---------------------------------------------------------------------------
// Per-host rate limiting

class QuotaExhaustedError extends Error {
  name = "QuotaExhaustedError";

  constructor(host: string, reason: string) {
    super(`${host}: ${reason}`);
  }
}

/**
 * Sequential per-host pacer. `weight` is what the host bills for the request;
 * the gap to the next request is weight / callsPerMinute.
 */
class Limiter {
  private chain: Promise<unknown> = Promise.resolve();
  private nextAt = 0;
  /** Set once the host's quota (or our budget) is spent; remaining tasks skip. */
  exhausted: string | null = null;
  requests = 0;
  used = 0;

  constructor(
    readonly name: string,
    private callsPerMinute: number,
    private budget = Infinity,
  ) {}

  run<T>(fn: () => Promise<T>, weight = 1): Promise<T> {
    const p = this.chain.then(async () => {
      if (!this.exhausted && this.used + weight > this.budget)
        this.exhausted = `Budget von ${this.budget} Calls für diesen Lauf erreicht`;
      if (this.exhausted)
        throw new QuotaExhaustedError(this.name, this.exhausted);
      const wait = this.nextAt - Date.now();
      if (wait > 0) await sleep(wait);
      this.nextAt = Date.now() + (weight * 60_000) / this.callsPerMinute;
      this.used += weight;
      this.requests++;
      return fn();
    });
    this.chain = p.catch(() => {});
    return p;
  }

  pause(ms: number) {
    this.nextAt = Math.max(this.nextAt, Date.now() + ms);
  }
}

// Elevation and archive share one quota (per IP, across all open-meteo.com hosts).
const openMeteo = new Limiter("Open-Meteo", 500, OPEN_METEO_BUDGET);
// Both routers exist side by side: ORS is asked first, and when its daily quota
// runs out the run continues on the OSRM demo instead of stopping. The gate
// makes that safe, and the upgrade pass re-fetches those keys on the next run
// with quota left.
const ors = ORS ? new Limiter("OpenRouteService", 38) : null;
const osrm = new Limiter("OSRM-Demo", 55);

function getJson<T>(
  lim: Limiter,
  weight: number,
  url: string,
  init?: RequestInit,
): Promise<T> {
  return lim.run(async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url, init);
      if (res.ok) return (await res.json()) as T;

      const body = await res.text().catch(() => "");
      const reason = (() => {
        try {
          return (
            (JSON.parse(body) as { reason?: string; error?: string }).reason ??
            body
          );
        } catch {
          return body;
        }
      })()
        .replaceAll(/\s+/gu, " ")
        .trim()
        .slice(0, 120);

      // Open-Meteo: 429 "Hourly/Daily API request limit exceeded"; ORS: 403 "Quota exceeded" (daily).
      if (
        (res.status === 429 && /hourly|daily/iu.test(reason)) ||
        (res.status === 403 && /quota/iu.test(reason))
      ) {
        lim.exhausted = reason;
        throw new QuotaExhaustedError(lim.name, reason);
      }
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        const wait =
          retryAfter > 0
            ? Math.min(retryAfter, 90_000)
            : res.status === 429
              ? 60_000
              : 5000 * (attempt + 1);
        console.log(
          `  ${lim.name} ${res.status} (${reason || "keine Angabe"}), warte ${wait / 1000}s …`,
        );
        lim.pause(wait);
        await sleep(wait);
        continue;
      }
      throw new Error(`${res.status} ${reason} ${url.slice(0, 80)}`);
    }
    throw new Error(`${lim.name}: aufgegeben nach 5 Versuchen`);
  }, weight);
}

// ---------------------------------------------------------------------------
// Fetchers

async function routeVia(
  source: RouteSource,
  waypoints: LatLon[],
): Promise<RouteGeometry> {
  const out: RouteGeometry = [];
  const push = (cs: RouteGeometry) =>
    out.push(...(out.length ? cs.slice(1) : cs));

  if (source === "ors") {
    for (let i = 0; i < waypoints.length - 1; i += 49) {
      const chunk = waypoints.slice(i, Math.min(i + 50, waypoints.length));
      const json = await getJson<{
        features: { geometry: { coordinates: [number, number][] } }[];
      }>(
        ors!,
        1,
        "https://api.openrouteservice.org/v2/directions/cycling-road/geojson",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: ORS },
          body: JSON.stringify({
            coordinates: chunk.map((c) => [c.lon, c.lat]),
            // Some ascent starts sit in a village centre > 350 m (ORS default) from a cycling-road edge.
            radiuses: chunk.map(() => SNAP_RADIUS * 1000),
            instructions: false,
          }),
        },
      );
      push(
        json.features[0]!.geometry.coordinates.map(([x, y]) => [
          +y.toFixed(5),
          +x.toFixed(5),
        ]),
      );
    }
  } else {
    for (let i = 0; i < waypoints.length - 1; i += 11) {
      const chunk = waypoints.slice(i, Math.min(i + 12, waypoints.length));
      const coords = chunk.map((c) => `${c.lon},${c.lat}`).join(";");
      const json = await getJson<{
        code: string;
        routes: { geometry: { coordinates: [number, number][] } }[];
      }>(
        osrm,
        1,
        `${OSRM_HOST}/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      );
      if (json.code !== "Ok") throw new Error(json.code);
      push(
        json.routes[0]!.geometry.coordinates.map(([x, y]) => [
          +y.toFixed(5),
          +x.toFixed(5),
        ]),
      );
    }
  }
  return out;
}

/** ORS first, OSRM as the fallback once ORS says the daily quota is spent. */
async function route(
  waypoints: LatLon[],
): Promise<{ geom: RouteGeometry; source: RouteSource }> {
  if (ors && !ors.exhausted) {
    try {
      return { geom: await routeVia("ors", waypoints), source: "ors" };
    } catch (error) {
      if (!(error instanceof QuotaExhaustedError)) throw error;
      console.log(
        "  ORS-Kontingent erschöpft – weiter mit OSRM (Autoprofil), der Gate fängt die Ausreißer ab",
      );
    }
  }
  return { geom: await routeVia("osrm", waypoints), source: "osrm" };
}

/** DEM height at the pass coordinates themselves, to catch a wrong summit point. */
async function summitElevations(list: Pass[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < list.length; i += PROFILE_POINTS) {
    const chunk = list.slice(i, i + PROFILE_POINTS);
    const { elevation } = await getJson<{ elevation: number[] }>(
      openMeteo,
      chunk.length,
      `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((p) => p.lat).join(",")}` +
        `&longitude=${chunk.map((p) => p.lon).join(",")}`,
    );
    chunk.forEach((p, j) => {
      out[p.slug] = Math.round(elevation[j]!);
    });
  }
  return out;
}

/** Elevations from the Copernicus DEM (Open-Meteo, no key needed). */
async function profile(geom: RouteGeometry): Promise<ElevationProfile> {
  const n = Math.min(PROFILE_POINTS, geom.length);
  const step = (geom.length - 1) / (n - 1);
  const pts = Array.from({ length: n }, (_, i) => geom[Math.round(i * step)]!);
  const { elevation } = await getJson<{ elevation: number[] }>(
    openMeteo,
    PROFILE_WEIGHT,
    `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((c) => c[0]).join(",")}&longitude=${pts.map((c) => c[1]).join(",")}`,
  );

  let total = 0;
  const dist = [0];
  for (let i = 1; i < pts.length; i++) {
    total += haversine(pts[i - 1]!, pts[i]!);
    dist.push(total);
  }
  // Elevation gain with 10 m smoothing, otherwise DEM noise adds up
  let gain = 0;
  let base = elevation[0]!;
  for (const e of elevation.slice(1)) {
    if (e - base >= 10) {
      gain += e - base;
      base = e;
    } else if (e < base) base = e;
  }
  return {
    km: +total.toFixed(1),
    elevationGain: Math.round(gain),
    start: Math.round(elevation[0]!),
    top: Math.round(Math.max(...elevation)),
    avgGradient: +((elevation.at(-1)! - elevation[0]!) / (total * 10)).toFixed(
      1,
    ),
    dist: dist.map((d) => +d.toFixed(2)),
    ele: elevation.map(Math.round),
  };
}

/** ERA5-Land 2015–2024, condensed into 24 half-months. */
async function climate(pass: Pass): Promise<ClimateYear> {
  const d = await getJson<{
    daily: {
      time: string[];
      temperature_2m_max: (number | null)[];
      temperature_2m_min: (number | null)[];
      snowfall_sum: (number | null)[];
      precipitation_sum: (number | null)[];
    };
  }>(
    openMeteo,
    CLIMATE_WEIGHT,
    `https://archive-api.open-meteo.com/v1/archive?latitude=${pass.lat}&longitude=${pass.lon}` +
      `&elevation=${pass.elevation}&start_date=${CLIMATE_FROM}&end_date=${CLIMATE_TO}` +
      `&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum&timezone=Europe%2FBerlin`,
  );
  const buckets = Array.from({ length: 24 }, () => ({
    n: 0,
    tx: 0,
    tn: 0,
    snow: 0,
    frost: 0,
    wet: 0,
  }));
  d.daily.time.forEach((t, i) => {
    const tmax = d.daily.temperature_2m_max[i];
    const tmin = d.daily.temperature_2m_min[i];
    if (tmax == null || tmin == null) return;
    const month = +t.slice(5, 7);
    const day = +t.slice(8, 10);
    const b = buckets[(month - 1) * 2 + (day > 15 ? 1 : 0)]!;
    b.n++;
    b.tx += tmax;
    b.tn += tmin;
    if ((d.daily.snowfall_sum[i] ?? 0) >= 1) b.snow++;
    if (tmin < 0) b.frost++;
    if ((d.daily.precipitation_sum[i] ?? 0) >= 1) b.wet++;
  });
  return buckets.map((b) =>
    b.n
      ? {
          tmax: +(b.tx / b.n).toFixed(1),
          tmin: +(b.tn / b.n).toFixed(1),
          snowPct: Math.round((b.snow / b.n) * 100),
          frostPct: Math.round((b.frost / b.n) * 100),
          wetPct: Math.round((b.wet / b.n) * 100),
        }
      : null,
  );
}

// ---------------------------------------------------------------------------
await mkdir(OUT, { recursive: true });
const routes = await readJson<Record<string, RouteGeometry>>("routes.json", {});
const profiles = await readJson<Record<string, ElevationProfile>>(
  "profiles.json",
  {},
);
const climates = await readJson<Record<string, ClimateYear>>(
  "climate.json",
  {},
);
const meta = await readJson<Record<string, RouteMeta>>("routes-meta.json", {});
const rejected = await readJson<Record<string, RouteRejection>>(
  "rejected.json",
  {},
);
const summits = await readJson<Record<string, number>>("summits.json", {});

type RouteJob = {
  key: string;
  label: string;
  waypoints: LatLon[];
  check?: RouteCheck;
} & (
  | { kind: "ascent"; from: LatLon; summit: LatLon; elevation: number }
  | { kind: "tour"; statedKm: number }
);

const routeJobs: RouteJob[] = [
  ...(passes as Pass[]).flatMap((p) =>
    p.ascents.map((a, i): RouteJob => ({
      kind: "ascent",
      key: `${p.slug}:${i}`,
      label: `${p.name} ab ${a.label}`,
      waypoints: [a.from, { lat: p.lat, lon: p.lon }],
      check: a.check,
      from: a.from,
      summit: { lat: p.lat, lon: p.lon },
      elevation: p.elevation,
    })),
  ),
  ...(tours as Tour[]).map((t): RouteJob => ({
    kind: "tour",
    key: `tour:${t.slug}`,
    label: `Tour ${t.name}`,
    waypoints: t.waypoints,
    check: t.check,
    statedKm: t.km,
  })),
];

/** Measure a geometry; the profile fields stay null until one has been fetched. */
const measure = (job: RouteJob, geom: RouteGeometry): RouteMetrics =>
  job.kind === "ascent"
    ? ascentMetrics(geom, job.from, job.summit)
    : tourMetrics(geom, job.waypoints, job.statedKm);

const judge = (job: RouteJob, m: RouteMetrics) =>
  job.kind === "ascent"
    ? checkAscent(m as AscentMetrics, job.check)
    : checkTour(m as TourMetrics, job.check);

/**
 * Re-routing a stored OSRM route also invalidates its profile, and a profile is
 * 100 Open-Meteo calls – upgrading everything at once costs more than filling
 * every gap. So the upgrade is a deliberate second campaign behind
 * `--upgrade-osrm`; until it has run, `data:check` warns about each car-profile
 * route it finds.
 */
const upgradable = (j: RouteJob) =>
  routes[j.key] !== undefined &&
  ORS !== "" &&
  (meta[j.key]?.source ?? "osrm") === "osrm";
const needsRoute = (j: RouteJob) =>
  !routes[j.key] || (UPGRADE_OSRM && upgradable(j));
const isRejected = (j: RouteJob) => j.key in rejected && !RETRY_REJECTED;

const pendingRoutes = () =>
  routeJobs.filter((j) => isOnly(j.key) && needsRoute(j) && !isRejected(j));
const pendingProfiles = () =>
  routeJobs.filter(
    (j) =>
      j.kind === "ascent" &&
      isOnly(j.key) &&
      routes[j.key] &&
      !profiles[j.key] &&
      !isRejected(j) &&
      // Deferred until the geometry is final, see gate().
      !upgradable(j),
  );
const pendingClimate = () =>
  (passes as Pass[]).filter((p) => !climates[p.slug]);
const pendingSummits = () =>
  (passes as Pass[]).filter((p) => !(p.slug in summits));

const report = () => {
  const r = pendingRoutes().length;
  const p = pendingProfiles().length;
  const c = pendingClimate().length;
  const s = pendingSummits().length;
  // A newly routed ascent needs a profile too, and that is what actually costs.
  const newProfiles =
    p +
    routeJobs.filter(
      (j) =>
        j.kind === "ascent" && isOnly(j.key) && needsRoute(j) && !isRejected(j),
    ).length;
  const calls = newProfiles * PROFILE_WEIGHT + c * CLIMATE_WEIGHT + s;
  const up = routeJobs.filter(upgradable).length;
  console.log(
    `Fehlend: ${r} Routen, ${p} Profile, ${c} Klimareihen, ${s} Gipfelhöhen${
      calls
        ? ` (≈ ${calls} Open-Meteo-Calls ≈ ${Math.ceil(calls / Math.min(OPEN_METEO_BUDGET, OPEN_METEO_HOURLY))} Läufe à ${OPEN_METEO_BUDGET})`
        : ""
    }${
      Object.keys(rejected).length
        ? ` · ${Object.keys(rejected).length} abgewiesen (rejected.json)`
        : ""
    }${up && !UPGRADE_OSRM ? ` · ${up} OSRM-Routen aufrüstbar (--upgrade-osrm)` : ""}`,
  );
  return r + p + c + s;
};

if (PENDING_ONLY) {
  console.log(
    pendingRoutes().length +
      pendingProfiles().length +
      pendingClimate().length +
      pendingSummits().length,
  );
  process.exit(0);
}
if (STATUS_ONLY) {
  report();
  process.exit(0);
}
if (FORMAT_ONLY) {
  await write("routes.json", routes);
  await write("profiles.json", profiles);
  await write("climate.json", climates);
  await write("routes-meta.json", meta);
  await write("rejected.json", rejected);
  await write("summits.json", summits);
  await writing;
  process.exit(0);
}

console.log(
  ORS
    ? `Routing über OpenRouteService (Rennrad-Profil), Fallback OSRM – ORS_KEY vorhanden (${ORS.length} Zeichen)`
    : "Routing über OSRM-Demo (Autoprofil) – ORS_KEY ist NICHT gesetzt, deshalb Autoprofil",
);
if (RETRY_REJECTED && Object.keys(rejected).length)
  console.log(
    `${Object.keys(rejected).length} abgewiesene Schlüssel werden erneut versucht`,
  );
report();

const fail = (what: string, e: unknown) =>
  console.error(`  ${what} FEHLER ${(e as Error).message}`);

/** Removes a key everywhere and records why, keeping the date of the first rejection. */
async function reject(
  job: RouteJob,
  reasons: string[],
  m: RouteMetrics,
  source: RouteSource,
  hash: string,
) {
  const before = rejected[job.key];
  const unchanged = before?.hash === hash;
  rejected[job.key] = {
    reasons,
    metrics: m,
    source,
    hash,
    firstSeen: before?.firstSeen ?? TODAY,
    lastSeen: TODAY,
    // Keep the profile: it is the only expensive part, so a later retry after a
    // threshold change costs nothing.
    ...(profiles[job.key]
      ? { profile: profiles[job.key] }
      : before?.profile
        ? { profile: before.profile }
        : {}),
  };
  Reflect.deleteProperty(routes, job.key);
  Reflect.deleteProperty(profiles, job.key);
  Reflect.deleteProperty(meta, job.key);
  await write("routes.json", routes);
  await write("profiles.json", profiles);
  await write("routes-meta.json", meta);
  await write("rejected.json", rejected);
  console.log(
    `Abgewiesen: ${job.label} (${source})${unchanged ? " – unveränderte Geometrie, die Koordinaten sind das Problem" : ""}\n${reasons
      .map((r) => `    ${r}`)
      .join("\n")}`,
  );
}

async function accept(job: RouteJob, geom: RouteGeometry, source: RouteSource) {
  routes[job.key] = geom;
  meta[job.key] = { source, fetchedAt: TODAY };
  Reflect.deleteProperty(rejected, job.key);
  await write("routes.json", routes);
  await write("routes-meta.json", meta);
  await write("rejected.json", rejected);
}

/**
 * Geometry checks, then – for ascents – the profile and its checks. The route is
 * stored as soon as the geometry passes, so a run cut short by the Open-Meteo
 * budget keeps its (free) routing work; the profile checks of the next run can
 * still take it back out.
 */
async function gate(
  job: RouteJob,
  geom: RouteGeometry,
  source: RouteSource,
  /** False when the geometry came out of routes.json and is only being judged. */
  fetched = true,
) {
  const hash = geometryHash(geom);
  let m = measure(job, geom);
  const bad = judge(job, m);
  if (bad.length) return reject(job, bad, m, source, hash);

  if (fetched) {
    await accept(job, geom, source);
    console.log(
      `Route: ${job.label} (${source}, ${(m as AscentMetrics).km} km)`,
    );
  }
  if (job.kind !== "ascent") return;

  // 3: an OSRM route stored while an ORS key exists is provisional – the
  // upgrade pass will replace the geometry and the profile would have to be
  // paid for a second time. 100 Open-Meteo calls is far too much to spend on
  // a road we already know is the wrong one.
  if (source === "osrm" && ORS) {
    console.log(
      `Profil aufgeschoben: ${job.label} (OSRM-Route, erst nach --upgrade-osrm)`,
    );
    return;
  }

  // A cached profile from an earlier rejection is only valid for the very same
  // geometry; otherwise it has to be paid for again.
  const cached =
    rejected[job.key]?.hash === hash ? rejected[job.key]?.profile : undefined;
  if (!cached && profiles[job.key]) {
    // The geometry was just replaced, so the stored profile belongs to a road
    // that is no longer there. Drop it before fetching, otherwise a run that
    // runs out of Open-Meteo budget leaves a profile from the old route behind.
    Reflect.deleteProperty(profiles, job.key);
    await write("profiles.json", profiles);
  }
  let prof: ElevationProfile;
  try {
    prof = cached ?? (await profile(geom));
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError))
      fail(`Profil ${job.label}`, error);
    return; // route stays, profile follows in the next run
  }
  m = withProfile(m as AscentMetrics, prof, job.elevation);
  const badProfile = judge(job, m);
  if (badProfile.length) {
    profiles[job.key] = prof; // so reject() carries it into the cache
    return reject(job, badProfile, m, source, hash);
  }
  profiles[job.key] = prof;
  await write("profiles.json", profiles);
  console.log(
    `Profil: ${job.label} (${prof.km} km, ${prof.elevationGain} Hm, Gipfel ${prof.top} m)`,
  );
}

// Pipeline 1: routing. Each route runs through the gate and hands its profile on.
const routing = pendingRoutes().map(async (job) => {
  const upgrade = routes[job.key] !== undefined;
  try {
    const { geom, source } = await route(job.waypoints);
    if (upgrade && (meta[job.key]?.source ?? "osrm") === source) return; // nothing gained
    await gate(job, geom, source);
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError))
      fail(`Route ${job.label}`, error);
  }
});

// Pipeline 2: profiles for routes that already exist and were never judged.
const profiling = pendingProfiles().map((job) =>
  gate(job, routes[job.key]!, meta[job.key]?.source ?? "osrm", false),
);

// Pipeline 3: the DEM height of the pass points themselves – one cheap batch.
const summiting = (async () => {
  const todo = pendingSummits();
  if (!todo.length) return;
  try {
    Object.assign(summits, await summitElevations(todo));
    await write("summits.json", summits);
    const off = todo.filter(
      (p) =>
        summits[p.slug] !== undefined &&
        checkSummit(summits[p.slug]!, p.elevation).length,
    );
    console.log(`Gipfelhöhen: ${todo.length} geprüft, ${off.length} auffällig`);
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError)) fail("Gipfelhöhen", error);
  }
})();

// Pipeline 4: climate. Queued after the (cheaper) profiles; the Open-Meteo budget cuts it off.
console.log(
  `Open-Meteo-Budget für diesen Lauf: ${OPEN_METEO_BUDGET} Calls (OPEN_METEO_BUDGET)`,
);
const climating = pendingClimate().map(async (pass) => {
  try {
    climates[pass.slug] = await climate(pass);
    await write("climate.json", climates);
    console.log(`Klima: ${pass.name}`);
  } catch (error) {
    if (!(error instanceof QuotaExhaustedError))
      fail(`Klima ${pass.name}`, error);
  }
});

await Promise.all([...routing, ...profiling, summiting, ...climating]);
await writing;

for (const lim of [ors, osrm, openMeteo]) {
  if (lim?.exhausted)
    console.log(
      `${lim.name}: Kontingent erschöpft (${lim.exhausted}) – Rest im nächsten Lauf`,
    );
}
const osrmRoutes = Object.values(meta).filter(
  (x) => x.source === "osrm",
).length;
console.log(
  `Fertig: ${Object.keys(routes).length} Routen, ${Object.keys(profiles).length} Profile, ` +
    `${Object.keys(climates).length} Klimareihen` +
    ` (${openMeteo.requests} Open-Meteo-Requests ≈ ${openMeteo.used} Calls)`,
);
// Split by router on purpose: a combined count cannot answer "did ORS run at
// all?", which is the first question when every stored route says osrm.
console.log(
  `Routing: ${ors?.requests ?? 0} ORS-Requests, ${osrm.requests} OSRM-Requests${
    ORS
      ? ors?.exhausted
        ? ` – ORS gestoppt: ${ors.exhausted}`
        : ors?.requests
          ? ""
          : " – ORS war eingerichtet, wurde aber nie gebraucht (nichts zu routen?)"
      : " – ohne ORS_KEY, deshalb Autoprofil"
  }`,
);
if (osrmRoutes)
  console.log(
    `${osrmRoutes} Routen stammen vom OSRM-Autoprofil und sollten mit ORS_KEY erneuert werden`,
  );
report();
