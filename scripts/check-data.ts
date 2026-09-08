#!/usr/bin/env bun
/**
 * Validates every file in `data/` against `lib/schema.ts`, then checks the
 * cross references, completeness and route quality the schemas cannot see.
 * Runs in CI before the build.
 *
 *   bun run data:check            # errors and warnings
 *   bun run data:check --explain  # every route with its measured values
 *
 * The quality part re-measures the stored geometries instead of trusting what
 * the build wrote, so a hand-edited routes.json cannot slip through and a
 * changed threshold in scripts/lib/validate.ts shows its effect on the whole
 * dataset immediately – offline, without a single API call. That is what makes
 * the numbers in `LIMITS` tunable rather than folklore.
 *
 * Errors and warnings are split by what they protect. A stored route that fails
 * a check is an error: that is the invariant, nothing wrong is served. A route
 * the gate refused is a warning: it is unfinished curation – a coordinate to
 * fix, an `ascent.check` to set, or a limit to revisit – and it must neither
 * block a merge nor stop the refresh workflow from committing what it fetched.
 * Plan 11 promotes it, together with "Route fehlt", once the backlog is gone.
 */
import type { z } from "zod";

import { FILES } from "../lib/schema";
import { fold } from "../lib/search";
import type {
  AscentMetrics,
  Pass,
  RouteMetrics,
  RouteRejection,
  Tour,
  TourMetrics,
  Town,
} from "../lib/types";
import { renderJsonSchema, schemaFileFor } from "./emit-json-schema";
import {
  ascentMetrics,
  checkAscent,
  checkSummit,
  checkTour,
  tourMetrics,
  withProfile,
} from "./lib/validate";

const DATA = new URL("../data/", import.meta.url);
const EXPLAIN = process.argv.includes("--explain");
const errors: string[] = [];
const warnings: string[] = [];
const explained: string[] = [];

// ── 1. Shape: every file against its schema ──────────────────────────────────

const HAND_MAINTAINED = ["passes.json", "tours.json", "towns.json"] as const;

async function load<K extends keyof typeof FILES>(
  file: K,
): Promise<z.infer<(typeof FILES)[K]> | null> {
  const f = Bun.file(new URL(file, DATA));
  // The gate's files appear with the first run that needs them.
  if (!(await f.exists())) return {} as z.infer<(typeof FILES)[K]>;
  const raw = await f.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    errors.push(`${file}: kein gültiges JSON (${(error as Error).message})`);
    return null;
  }
  // Hand-maintained files keep one canonical layout so diffs stay readable.
  if (
    HAND_MAINTAINED.includes(file as never) &&
    raw !== `${JSON.stringify(data, null, 1)}\n`
  )
    errors.push(
      `${file}: nicht kanonisch formatiert (JSON.stringify(data, null, 1) + Zeilenumbruch)`,
    );
  const result = FILES[file].safeParse(data);
  if (result.success) return result.data as z.infer<(typeof FILES)[K]>;
  for (const issue of result.error.issues) {
    const path = issue.path
      .map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`))
      .join("")
      .replace(/^\./u, "");
    errors.push(`${file} › ${path || "(root)"}: ${issue.message}`);
  }
  return null;
}

const [
  passes,
  tours,
  towns,
  routes,
  profiles,
  climate,
  meta,
  rejected,
  summits,
] = await Promise.all([
  load("passes.json"),
  load("tours.json"),
  load("towns.json"),
  load("generated/routes.json"),
  load("generated/profiles.json"),
  load("generated/climate.json"),
  load("generated/routes-meta.json"),
  load("generated/rejected.json"),
  load("generated/summits.json"),
]);

for (const file of Object.keys(FILES) as (keyof typeof FILES)[]) {
  const target = Bun.file(new URL(`schema/${schemaFileFor(file)}`, DATA));
  const current = (await target.exists()) ? await target.text() : null;
  if (current !== renderJsonSchema(file))
    errors.push(
      `data/schema/${schemaFileFor(file)} ist veraltet (bun run data:schema)`,
    );
}

// ── 2. The route quality gate ────────────────────────────────────────────────

const days = (iso: string) =>
  Math.round((Date.now() - Date.parse(iso)) / 86_400_000);

/** Shared by ascents and tours: judge what is stored, and note where it came from. */
function inspect(
  key: string,
  label: string,
  metrics: RouteMetrics,
  reasons: string[],
) {
  const source = meta?.[key]?.source ?? "osrm";
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

// ── 3. References and completeness ──────────────────────────────────────────

const dupes = (list: { slug: string }[], what: string) => {
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.slug)) errors.push(`${what}: doppelter Slug ${x.slug}`);
    seen.add(x.slug);
  }
};

function checkPasses(list: Pass[]) {
  dupes(list, "Pässe");
  // Folded names and aliases must be unique – search would find two passes.
  const names = new Map<string, string>();
  for (const p of list) {
    const key = fold(p.name);
    const other = names.get(key);
    if (other) errors.push(`${p.slug}: Name fällt mit ${other} zusammen`);
    else names.set(key, p.slug);
  }
  for (const p of list)
    for (const alias of p.aliases ?? []) {
      const key = fold(alias);
      const owner = names.get(key);
      if (owner === p.slug)
        errors.push(`${p.slug}: Alias "${alias}" doppelt (Name oder Alias)`);
      else if (owner)
        errors.push(`${p.slug}: Alias "${alias}" gehört zu ${owner}`);
      else names.set(key, p.slug);
    }
  for (const p of list) {
    if (!p.ascents.length)
      warnings.push(`${p.slug}: keine Auffahrt hinterlegt`);

    const dem = summits?.[p.slug];
    if (dem === undefined)
      warnings.push(`${p.slug}: Gipfelhöhe ungeprüft (bun run data:build)`);
    else
      for (const r of checkSummit(dem, p.elevation))
        warnings.push(
          `${p.slug}: ${r} – Passkoordinate prüfen (DEM ${dem} m, angegeben ${p.elevation} m)`,
        );

    for (const [i, a] of p.ascents.entries()) {
      const key = `${p.slug}:${i}`;
      const geom = routes?.[key];
      if (!geom) {
        if (routes && !(rejected && key in rejected))
          warnings.push(`${key}: Route fehlt (bun run data:build)`);
        continue;
      }
      let m = ascentMetrics(geom, a.from, { lat: p.lat, lon: p.lon });
      const prof = profiles?.[key];
      if (prof) m = withProfile(m, prof, p.elevation);
      else if (profiles) warnings.push(`${key}: Profil fehlt`);
      inspect(
        key,
        `${p.name} ab ${a.label}`,
        m,
        checkAscent(m as AscentMetrics, a.check),
      );
    }
    if (climate && !(p.slug in climate))
      warnings.push(`${p.slug}: Klimareihe fehlt`);
  }
}

function checkTours(list: Tour[], slugs: Set<string>) {
  dupes(list, "Touren");
  for (const t of list) {
    for (const s of t.passes)
      if (!slugs.has(s)) errors.push(`Tour ${t.slug}: unbekannter Pass ${s}`);
    const key = `tour:${t.slug}`;
    const geom = routes?.[key];
    if (!geom) {
      if (routes && !(rejected && key in rejected))
        warnings.push(`Tour ${t.slug}: Route fehlt`);
      continue;
    }
    const m = tourMetrics(geom, t.waypoints, t.km);
    inspect(key, `Tour ${t.name}`, m, checkTour(m, t.check));
  }
}

function checkTowns(list: Town[]) {
  dupes(list, "Orte");
}

if (passes) checkPasses(passes);
// Without a valid pass list every reference would read as unknown.
if (tours && passes) checkTours(tours, new Set(passes.map((p) => p.slug)));
if (towns) checkTowns(towns);

// Rejections are unfinished curation: either the coordinates in data/*.json are
// wrong, or a limit in validate.ts is. Both need a human, neither blocks a merge.
// The stored reasons are history; the verdict is recomputed against the current
// limits and the entry's own `check`, so a changed threshold shows up here.
const checkFor = new Map<
  string,
  Pass["ascents"][number]["check"] | Tour["check"]
>();
for (const p of passes ?? [])
  for (const [i, a] of p.ascents.entries())
    checkFor.set(`${p.slug}:${i}`, a.check);
for (const t of tours ?? []) checkFor.set(`tour:${t.slug}`, t.check);

const rejudge = (key: string, r: RouteRejection) =>
  key.startsWith("tour:")
    ? checkTour(r.metrics as TourMetrics, checkFor.get(key) as Tour["check"])
    : checkAscent(
        r.metrics as AscentMetrics,
        checkFor.get(key) as Pass["ascents"][number]["check"],
      );

for (const [key, r] of Object.entries(rejected ?? {})) {
  const now = rejudge(key, r);
  const where = key.startsWith("tour:") ? "der Tour" : "der Auffahrt";
  warnings.push(
    now.length
      ? `${key}: abgewiesen seit ${r.firstSeen} (${days(r.firstSeen)} Tage, ${r.source}) – ${now.join("; ")}` +
          `\n       Koordinaten in data/*.json korrigieren, check an ${where} mit Begründung setzen,` +
          " oder nach einer Schwellenänderung: bun run data:build --retry-rejected"
      : `${key}: abgewiesen seit ${r.firstSeen}, würde mit den heutigen Grenzen bestehen – bun run data:build --retry-rejected`,
  );
  if (EXPLAIN)
    explained.push(
      `${now.length ? "✗" : "↺"} ${key.padEnd(36)} ${r.source.padEnd(4)} ${JSON.stringify(r.metrics)} (abgewiesen${now.length ? "" : ", würde jetzt bestehen"})`,
    );
}

// Generated keys that no longer belong to a pass or tour are stale, not wrong.
if (passes && tours) {
  const ascentKeys = new Set(
    passes.flatMap((p) => p.ascents.map((_, i) => `${p.slug}:${i}`)),
  );
  // Routes exist for ascents and tours, profiles for ascents only.
  const routeKeys = new Set([
    ...ascentKeys,
    ...tours.map((t) => `tour:${t.slug}`),
  ]);
  for (const key of Object.keys(routes ?? {}))
    if (!routeKeys.has(key))
      warnings.push(`routes.json: verwaiste Route ${key}`);
  for (const key of Object.keys(profiles ?? {}))
    if (!ascentKeys.has(key))
      warnings.push(`profiles.json: verwaistes Profil ${key}`);
  for (const key of [
    ...Object.keys(meta ?? {}),
    ...Object.keys(rejected ?? {}),
  ])
    if (!routeKeys.has(key))
      warnings.push(`routes-meta/rejected.json: verwaister Schlüssel ${key}`);
  const slugs = new Set(passes.map((p) => p.slug));
  for (const key of Object.keys(climate ?? {}))
    if (!slugs.has(key))
      warnings.push(`climate.json: verwaiste Klimareihe ${key}`);
  for (const key of Object.keys(summits ?? {}))
    if (!slugs.has(key))
      warnings.push(`summits.json: verwaiste Gipfelhöhe ${key}`);
}

if (EXPLAIN) {
  console.log(
    "Gemessene Werte je Route (✗ = verletzt eine Grenze aus scripts/lib/validate.ts, ↺ = abgewiesen, würde heute bestehen):",
  );
  for (const line of explained.toSorted()) console.log(`  ${line}`);
  console.log();
}
for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`FEHLER ${e}`);
const rejectedCount = Object.keys(rejected ?? {}).length;
console.log(
  `${passes?.length ?? 0} Pässe, ${tours?.length ?? 0} Touren, ${towns?.length ?? 0} Orte · ${Object.keys(routes ?? {}).length} Routen geprüft${
    rejectedCount ? `, ${rejectedCount} abgewiesen` : ""
  } · ${errors.length} Fehler, ${warnings.length} Warnungen`,
);
if (errors.length) process.exit(1);
