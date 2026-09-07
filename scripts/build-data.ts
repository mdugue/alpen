#!/usr/bin/env bun
/**
 * Precomputation of all static data.
 *
 *   bun run data:build              # OSRM demo (car profile)
 *   ORS_KEY=… bun run data:build    # OpenRouteService, road-cycling profile
 *
 * Writes to data/generated/. Intermediate state is saved after every step;
 * the run can be aborted and resumes. Results belong in the repo – nothing
 * is fetched at runtime.
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readJson<T>(name: string, fallback: T): Promise<T> {
  const f = Bun.file(new URL(name, OUT));
  return (await f.exists()) ? ((await f.json()) as T) : fallback;
}
const write = (name: string, data: unknown) =>
  Bun.write(new URL(name, OUT), JSON.stringify(data));

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      console.log(`  ${res.status}, warte …`);
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} ${url.slice(0, 80)}`);
  }
  throw new Error("aufgegeben nach 4 Versuchen");
}

async function route(waypoints: LatLon[]): Promise<RouteGeometry> {
  const out: RouteGeometry = [];
  const push = (cs: RouteGeometry) => out.push(...(out.length ? cs.slice(1) : cs));

  if (ORS) {
    for (let i = 0; i < waypoints.length - 1; i += 49) {
      const chunk = waypoints.slice(i, Math.min(i + 50, waypoints.length));
      const json = await getJson<{ features: { geometry: { coordinates: [number, number][] } }[] }>(
        "https://api.openrouteservice.org/v2/directions/cycling-road/geojson",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: ORS },
          body: JSON.stringify({
            coordinates: chunk.map((c) => [c.lon, c.lat]),
            instructions: false,
          }),
        },
      );
      push(json.features[0]!.geometry.coordinates.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]));
      await sleep(1600); // ORS: 40 requests/minute
    }
  } else {
    for (let i = 0; i < waypoints.length - 1; i += 11) {
      const chunk = waypoints.slice(i, Math.min(i + 12, waypoints.length));
      const coords = chunk.map((c) => `${c.lon},${c.lat}`).join(";");
      const json = await getJson<{ code: string; routes: { geometry: { coordinates: [number, number][] } }[] }>(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      );
      if (json.code !== "Ok") throw new Error(json.code);
      push(json.routes[0]!.geometry.coordinates.map(([x, y]) => [+y.toFixed(5), +x.toFixed(5)]));
      await sleep(700);
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
  const n = Math.min(100, geom.length);
  const step = (geom.length - 1) / (n - 1);
  const pts = Array.from({ length: n }, (_, i) => geom[Math.round(i * step)]!);
  const { elevation } = await getJson<{ elevation: number[] }>(
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
    `https://archive-api.open-meteo.com/v1/archive?latitude=${pass.lat}&longitude=${pass.lon}` +
      `&elevation=${pass.elevation}&start_date=2015-01-01&end_date=2024-12-31` +
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

console.log(
  ORS
    ? "Routing über OpenRouteService (Rennrad-Profil)"
    : "Routing über OSRM-Demo (Autoprofil) – ORS_KEY setzen für das Rennrad-Profil",
);

let n = 0;
for (const pass of passes as Pass[]) {
  for (const [i, ascent] of pass.ascents.entries()) {
    const key = `${pass.slug}:${i}`;
    if (!routes[key]) {
      try {
        console.log(`Route ${++n}: ${pass.name} ab ${ascent.label}`);
        routes[key] = await route([ascent.from, { lat: pass.lat, lon: pass.lon }]);
        await write("routes.json", routes);
      } catch (e) {
        console.error(`  FEHLER ${(e as Error).message}`);
        continue;
      }
    }
    if (!profiles[key]) {
      try {
        profiles[key] = await profile(routes[key]!);
        await write("profiles.json", profiles);
        await sleep(300);
      } catch (e) {
        console.error(`  Profil FEHLER ${(e as Error).message}`);
      }
    }
  }
  if (!climates[pass.slug]) {
    try {
      console.log(`Klima: ${pass.name}`);
      climates[pass.slug] = await climate(pass);
      await write("climate.json", climates);
      await sleep(400);
    } catch (e) {
      console.error(`  Klima FEHLER ${(e as Error).message}`);
    }
  }
}

for (const tour of tours as Tour[]) {
  const key = `tour:${tour.slug}`;
  if (routes[key]) continue;
  try {
    console.log(`Tour: ${tour.name}`);
    routes[key] = await route(tour.waypoints);
    await write("routes.json", routes);
  } catch (e) {
    console.error(`  FEHLER ${(e as Error).message}`);
  }
}

console.log(
  `Fertig: ${Object.keys(routes).length} Routen, ${Object.keys(profiles).length} Profile, ${Object.keys(climates).length} Klimareihen`,
);
