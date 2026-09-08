#!/usr/bin/env bun
/**
 * Precomputation of all static data.
 *
 *   bun run data:build              # OSRM demo (car profile)
 *   ORS_KEY=… bun run data:build    # OpenRouteService, road-cycling profile
 *   bun run data:build --status     # only report what is missing and what it costs
  bun run data:build --format     # only rewrite data/generated/*.json in the canonical format
 *
 * Writes to data/generated/. Intermediate state is saved after every step;
 * the run can be aborted and resumes. Results belong in the repo – nothing
 * is fetched at runtime.
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
import type {
  ClimateYear,
  ElevationProfile,
  LatLon,
  Pass,
  RouteGeometry,
  Tour,
} from "../lib/types";

const OUT = new URL("../data/generated/", import.meta.url);
const ORS = process.env.ORS_KEY ?? "";
const STATUS_ONLY = process.argv.includes("--status");
const FORMAT_ONLY = process.argv.includes("--format");
const OPEN_METEO_BUDGET = Number(process.env.OPEN_METEO_BUDGET ?? 4500);
const OPEN_METEO_DAILY = 10_000;
const CLIMATE_FROM = "2015-01-01";
const CLIMATE_TO = "2024-12-31";
const PROFILE_POINTS = 100;
/** Open-Meteo weight of one climate request: one call per started 14-day period. */
const CLIMATE_WEIGHT = Math.ceil(
  (Date.parse(CLIMATE_TO) - Date.parse(CLIMATE_FROM)) / 86_400_000 / 14,
);
/** Open-Meteo weight of one elevation request: one call per location. */
const PROFILE_WEIGHT = PROFILE_POINTS;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(data[k])}`)
    .join(",\n")}\n}\n`;
// Writes are chained so concurrent pipelines never interleave a file write.
let writing: Promise<unknown> = Promise.resolve();
const write = (name: string, data: Record<string, unknown>) =>
  (writing = writing.then(() => Bun.write(new URL(name, OUT), format(data))));

// ---------------------------------------------------------------------------
// Per-host rate limiting

class QuotaExhausted extends Error {
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
      if (this.exhausted) throw new QuotaExhausted(this.name, this.exhausted);
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
const router = ORS ? new Limiter("OpenRouteService", 38) : new Limiter("OSRM-Demo", 55);

async function getJson<T>(lim: Limiter, weight: number, url: string, init?: RequestInit): Promise<T> {
  return lim.run(async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url, init);
      if (res.ok) return (await res.json()) as T;

      const body = await res.text().catch(() => "");
      const reason = (() => {
        try {
          return (JSON.parse(body) as { reason?: string; error?: string }).reason ?? body;
        } catch {
          return body;
        }
      })()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      // Open-Meteo: 429 "Hourly/Daily API request limit exceeded"; ORS: 403 "Quota exceeded" (daily).
      if ((res.status === 429 && /hourly|daily/i.test(reason)) || (res.status === 403 && /quota/i.test(reason))) {
        lim.exhausted = reason;
        throw new QuotaExhausted(lim.name, reason);
      }
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        const wait =
          retryAfter > 0 ? Math.min(retryAfter, 90_000) : res.status === 429 ? 60_000 : 5000 * (attempt + 1);
        console.log(`  ${lim.name} ${res.status} (${reason || "keine Angabe"}), warte ${wait / 1000}s …`);
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

async function route(waypoints: LatLon[]): Promise<RouteGeometry> {
  const out: RouteGeometry = [];
  const push = (cs: RouteGeometry) => out.push(...(out.length ? cs.slice(1) : cs));

  if (ORS) {
    for (let i = 0; i < waypoints.length - 1; i += 49) {
      const chunk = waypoints.slice(i, Math.min(i + 50, waypoints.length));
      const json = await getJson<{ features: { geometry: { coordinates: [number, number][] } }[] }>(
        router,
        1,
        "https://api.openrouteservice.org/v2/directions/cycling-road/geojson",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: ORS },
          body: JSON.stringify({
            coordinates: chunk.map((c) => [c.lon, c.lat]),
            // Some ascent starts sit in a village centre > 350 m (ORS default) from a cycling-road edge.
            radiuses: chunk.map(() => 2000),
            instructions: false,
          }),
        },
      );
      push(json.features[0]!.geometry.coordinates.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]));
    }
  } else {
    for (let i = 0; i < waypoints.length - 1; i += 11) {
      const chunk = waypoints.slice(i, Math.min(i + 12, waypoints.length));
      const coords = chunk.map((c) => `${c.lon},${c.lat}`).join(";");
      const json = await getJson<{ code: string; routes: { geometry: { coordinates: [number, number][] } }[] }>(
        router,
        1,
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      );
      if (json.code !== "Ok") throw new Error(json.code);
      push(json.routes[0]!.geometry.coordinates.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]));
    }
  }
  return out;
}

function haversine(a: RouteGeometry[number], b: RouteGeometry[number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
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
    avgGradient: +(((elevation.at(-1)! - elevation[0]!) / (total * 10))).toFixed(1),
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
  const buckets = Array.from({ length: 24 }, () => ({ n: 0, tx: 0, tn: 0, snow: 0, frost: 0, wet: 0 }));
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
const profiles = await readJson<Record<string, ElevationProfile>>("profiles.json", {});
const climates = await readJson<Record<string, ClimateYear>>("climate.json", {});

type RouteJob = { key: string; label: string; waypoints: LatLon[]; profile: boolean };
const routeJobs: RouteJob[] = [
  ...(passes as Pass[]).flatMap((p) =>
    p.ascents.map((a, i) => ({
      key: `${p.slug}:${i}`,
      label: `${p.name} ab ${a.label}`,
      waypoints: [a.from, { lat: p.lat, lon: p.lon }],
      profile: true,
    })),
  ),
  ...(tours as Tour[]).map((t) => ({
    key: `tour:${t.slug}`,
    label: `Tour ${t.name}`,
    waypoints: t.waypoints,
    profile: false,
  })),
];
const missingRoutes = routeJobs.filter((j) => !routes[j.key]);
const missingProfiles = routeJobs.filter((j) => j.profile && !profiles[j.key]);
const missingClimate = (passes as Pass[]).filter((p) => !climates[p.slug]);

const report = () => {
  const r = routeJobs.filter((j) => !routes[j.key]).length;
  const p = routeJobs.filter((j) => j.profile && !profiles[j.key]).length;
  const c = (passes as Pass[]).filter((x) => !climates[x.slug]).length;
  const calls = p * PROFILE_WEIGHT + c * CLIMATE_WEIGHT;
  console.log(
    `Fehlend: ${r} Routen, ${p} Profile, ${c} Klimareihen` +
      (calls ? ` (≈ ${calls} Open-Meteo-Calls ≈ ${Math.ceil(calls / OPEN_METEO_DAILY)} Tage Free-Tier)` : ""),
  );
  return r + p + c;
};

if (STATUS_ONLY) {
  report();
  process.exit(0);
}
if (FORMAT_ONLY) {
  await write("routes.json", routes);
  await write("profiles.json", profiles);
  await write("climate.json", climates);
  await writing;
  process.exit(0);
}

console.log(
  ORS
    ? "Routing über OpenRouteService (Rennrad-Profil)"
    : "Routing über OSRM-Demo (Autoprofil) – ORS_KEY setzen für das Rennrad-Profil",
);
report();

const fail = (what: string, e: unknown) =>
  console.error(`  ${what} FEHLER ${(e as Error).message}`);

async function doProfile(job: RouteJob) {
  try {
    profiles[job.key] = await profile(routes[job.key]!);
    await write("profiles.json", profiles);
    console.log(`Profil: ${job.label}`);
  } catch (e) {
    if (!(e instanceof QuotaExhausted)) fail(`Profil ${job.label}`, e);
  }
}

// Pipeline 1: routing (one host, sequential by limiter), each route hands its profile on.
const routing = missingRoutes.map(async (job) => {
  try {
    routes[job.key] = await route(job.waypoints);
    await write("routes.json", routes);
    console.log(`Route: ${job.label}`);
  } catch (e) {
    if (!(e instanceof QuotaExhausted)) fail(`Route ${job.label}`, e);
    return;
  }
  if (job.profile) await doProfile(job);
});

// Pipeline 2: profiles for routes that already exist.
const profiling = missingProfiles.filter((j) => routes[j.key]).map(doProfile);

// Pipeline 3: climate. Queued after the (cheaper) profiles; the Open-Meteo budget cuts it off.
console.log(`Open-Meteo-Budget für diesen Lauf: ${OPEN_METEO_BUDGET} Calls (OPEN_METEO_BUDGET)`);
const climating = missingClimate.map(async (pass) => {
  try {
    climates[pass.slug] = await climate(pass);
    await write("climate.json", climates);
    console.log(`Klima: ${pass.name}`);
  } catch (e) {
    if (!(e instanceof QuotaExhausted)) fail(`Klima ${pass.name}`, e);
  }
});

await Promise.all([...routing, ...profiling, ...climating]);
await writing;

for (const lim of [router, openMeteo]) {
  if (lim.exhausted) console.log(`${lim.name}: Kontingent erschöpft (${lim.exhausted}) – Rest im nächsten Lauf`);
}
console.log(
  `Fertig: ${Object.keys(routes).length} Routen, ${Object.keys(profiles).length} Profile, ${Object.keys(climates).length} Klimareihen` +
    ` (${router.requests} Routing-Requests, ${openMeteo.requests} Open-Meteo-Requests ≈ ${openMeteo.used} Calls)`,
);
report();
