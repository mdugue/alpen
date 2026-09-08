#!/usr/bin/env bun
import climate from "../data/generated/climate.json" with { type: "json" };
import profilesJson from "../data/generated/profiles.json" with { type: "json" };
import routesJson from "../data/generated/routes.json" with { type: "json" };
/**
 * Checks references, completeness and route quality. Runs in CI before the build.
 *
 *   bun run data:check            # errors and warnings
 *   bun run data:check --explain  # every route with its measured values
 *
 * The quality part re-measures the stored geometries instead of trusting what
 * the build wrote, so a hand-edited routes.json cannot slip through and a
 * changed threshold in scripts/lib/validate.ts shows its effect on the whole
 * dataset immediately – offline, without a single API call. That is what makes
 * the numbers in `LIMITS` tunable rather than folklore.
 */
import passes from "../data/passes.json" with { type: "json" };
import tours from "../data/tours.json" with { type: "json" };
import towns from "../data/towns.json" with { type: "json" };
import type {
  AscentMetrics,
  ElevationProfile,
  Pass,
  RouteGeometry,
  RouteMeta,
  RouteMetrics,
  RouteRejection,
  Tour,
  Town,
} from "../lib/types";
import {
  ascentMetrics,
  checkAscent,
  checkSummit,
  checkTour,
  tourMetrics,
  withProfile,
} from "./lib/validate";

const EXPLAIN = process.argv.includes("--explain");
const OUT = new URL("../data/generated/", import.meta.url);
const read = async <T>(name: string, fallback: T): Promise<T> => {
  const f = Bun.file(new URL(name, OUT));
  return (await f.exists()) ? ((await f.json()) as T) : fallback;
};

const routes = routesJson as unknown as Record<string, RouteGeometry>;
const profiles = profilesJson as unknown as Record<string, ElevationProfile>;
const meta = await read<Record<string, RouteMeta>>("routes-meta.json", {});
const rejected = await read<Record<string, RouteRejection>>(
  "rejected.json",
  {},
);
const summits = await read<Record<string, number>>("summits.json", {});

const errors: string[] = [];
const warnings: string[] = [];
const explained: string[] = [];
const slugs = new Set((passes as Pass[]).map((p) => p.slug));

const dupes = (list: { slug: string }[], what: string) => {
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.slug)) errors.push(`${what}: doppelter Slug ${x.slug}`);
    seen.add(x.slug);
  }
};
dupes(passes as Pass[], "Pässe");
dupes(tours as Tour[], "Touren");
dupes(towns as Town[], "Orte");

const days = (iso: string) =>
  Math.round((Date.now() - Date.parse(iso)) / 86_400_000);

/** Shared by ascents and tours: judge what is stored, and note where it came from. */
function inspect(
  key: string,
  label: string,
  metrics: RouteMetrics,
  reasons: string[],
) {
  const source = meta[key]?.source ?? "osrm";
  if (reasons.length)
    errors.push(
      `${key}: gespeicherte Route ist unplausibel – ${reasons.join("; ")} (${label})`,
    );
  else if (source === "osrm")
    warnings.push(
      `${key}: Route stammt vom OSRM-Autoprofil – mit ORS_KEY erneuern`,
    );
  if (EXPLAIN)
    explained.push(
      `${reasons.length ? "✗" : "·"} ${key.padEnd(36)} ${source.padEnd(4)} ${JSON.stringify(metrics)}${reasons.length ? `\n      ${reasons.join("\n      ")}` : ""}`,
    );
}

for (const p of passes as Pass[]) {
  if (p.lat < 43 || p.lat > 49 || p.lon < 4 || p.lon > 16)
    errors.push(`${p.slug}: Koordinaten außerhalb der Alpen`);
  if (p.elevation < 300 || p.elevation > 3500)
    errors.push(`${p.slug}: unplausible Höhe ${p.elevation}`);
  for (const key of ["beauty", "fame", "difficulty", "traffic"] as const) {
    const v = p[key];
    if (!Number.isInteger(v) || v < 1 || v > 5)
      errors.push(`${p.slug}: ${key} = ${v}`);
  }
  if (p.season && p.season.opens >= p.season.closes)
    errors.push(`${p.slug}: Saisonfenster verdreht`);
  if (!p.ascents.length) warnings.push(`${p.slug}: keine Auffahrt hinterlegt`);

  const dem = summits[p.slug];
  if (dem === undefined)
    warnings.push(`${p.slug}: Gipfelhöhe ungeprüft (bun run data:build)`);
  else
    for (const r of checkSummit(dem, p.elevation))
      warnings.push(
        `${p.slug}: ${r} – Passkoordinate prüfen (DEM ${dem} m, angegeben ${p.elevation} m)`,
      );

  p.ascents.forEach((a, i) => {
    const key = `${p.slug}:${i}`;
    if (a.check && !a.check.note?.trim())
      errors.push(`${key}: check ohne Begründung (note)`);
    const geom = routes[key];
    if (!geom) {
      if (!(key in rejected))
        warnings.push(`${key}: Route fehlt (bun run data:build)`);
      return;
    }
    let m = ascentMetrics(geom, a.from, { lat: p.lat, lon: p.lon });
    const prof = profiles[key];
    if (prof) m = withProfile(m, prof, p.elevation);
    else warnings.push(`${key}: Profil fehlt`);
    inspect(
      key,
      `${p.name} ab ${a.label}`,
      m,
      checkAscent(m as AscentMetrics, a.check),
    );
  });
  if (!(p.slug in climate)) warnings.push(`${p.slug}: Klimareihe fehlt`);
}

for (const t of tours as Tour[]) {
  for (const s of t.passes)
    if (!slugs.has(s)) errors.push(`Tour ${t.slug}: unbekannter Pass ${s}`);
  const key = `tour:${t.slug}`;
  if (t.check && !t.check.note?.trim())
    errors.push(`${key}: check ohne Begründung (note)`);
  const geom = routes[key];
  if (!geom) {
    if (!(key in rejected)) warnings.push(`Tour ${t.slug}: Route fehlt`);
    continue;
  }
  const m = tourMetrics(geom, t.waypoints, t.km);
  inspect(key, `Tour ${t.name}`, m, checkTour(m, t.check));
}

// Rejections are unfinished business: either the coordinates in data/*.json are
// wrong, or a limit in validate.ts is. Both need a human, so both are errors.
for (const [key, r] of Object.entries(rejected)) {
  errors.push(
    `${key}: abgewiesen seit ${r.firstSeen} (${days(r.firstSeen)} Tage, ${r.source}) – ${r.reasons.join("; ")}` +
      `\n       Koordinaten in data/*.json korrigieren, ascent.check mit Begründung setzen,` +
      ` oder nach einer Schwellenänderung: bun run data:build --retry-rejected`,
  );
  if (EXPLAIN)
    explained.push(
      `✗ ${key.padEnd(36)} ${r.source.padEnd(4)} ${JSON.stringify(r.metrics)} (abgewiesen)`,
    );
}

if (EXPLAIN) {
  console.log(
    "Gemessene Werte je Route (✗ = verletzt eine Grenze aus scripts/lib/validate.ts):",
  );
  for (const line of explained.toSorted()) console.log(`  ${line}`);
  console.log();
}
for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`FEHLER ${e}`);
console.log(
  `${(passes as Pass[]).length} Pässe, ${(tours as Tour[]).length} Touren, ${(towns as Town[]).length} Orte · ` +
    `${Object.keys(routes).length} Routen geprüft · ${errors.length} Fehler, ${warnings.length} Warnungen`,
);
if (errors.length) process.exit(1);
