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

import { isTraverse, ROAD_TYPE } from "../lib/regions";
import { ascentKey, tourKey } from "../lib/route-key";
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
  checkRoad,
  checkRoadAscent,
  checkSummit,
  checkTour,
  roadMetrics,
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

const load = async <K extends keyof typeof FILES>(
  file: K,
): Promise<z.infer<(typeof FILES)[K]> | null> => {
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
};

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
  photos,
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
  load("generated/photos.json"),
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
const inspect = (
  key: string,
  label: string,
  metrics: RouteMetrics,
  reasons: string[],
) => {
  const source = meta?.[key]?.source ?? "osrm";
  if (reasons.length)
    errors.push(
      `${key}: gespeicherte Route ist unplausibel – ${reasons.join("; ")} (${label})`,
    );
  // An OSRM route whose ORS candidate was refused is reported with that
  // rejection below, not as "erneuern": ORS has been asked.
  else if (source === "osrm" && !(rejected && key in rejected))
    warnings.push(
      `${key}: Route stammt vom OSRM-Autoprofil – mit ORS_KEY erneuern`,
    );
  if (EXPLAIN)
    explained.push(
      `${reasons.length ? "✗" : "·"} ${key.padEnd(36)} ${source.padEnd(4)} ${JSON.stringify(metrics)}${reasons.length ? `\n      ${reasons.join("\n      ")}` : ""}`,
    );
};

// ── 3. References and completeness ──────────────────────────────────────────

const dupes = (list: { slug: string }[], what: string) => {
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.slug)) errors.push(`${what}: doppelter Slug ${x.slug}`);
    seen.add(x.slug);
  }
};

/** The DEM height at the pass point, if it was read at the current coordinate. */
const summitWarnings = (p: Pass): string[] => {
  const summit = summits?.[p.slug];
  if (summit === undefined)
    return [`${p.slug}: Gipfelhöhe ungeprüft (bun run data:build)`];
  if (summit.lat !== p.lat || summit.lon !== p.lon)
    return [
      `${p.slug}: Gipfelhöhe ungeprüft – Passkoordinate wurde verschoben (bun run data:build)`,
    ];
  const out = checkSummit(summit.dem, p.elevation).map(
    (r) =>
      `${p.slug}: ${r} – Passkoordinate prüfen (DEM ${summit.dem} m, angegeben ${p.elevation} m); die Auffahrten werden bis dahin nicht geroutet (bun run data:locate ${p.slug})`,
  );
  if (summit.roadDist === undefined)
    out.push(`${p.slug}: Straßenabstand ungeprüft (bun run data:build)`);
  out.push(
    ...checkRoad(summit.roadDist).map(
      (r) =>
        `${p.slug}: ${r} – Passkoordinate auf die Straße legen; die Auffahrten werden bis dahin nicht geroutet (bun run data:locate ${p.slug})`,
    ),
  );
  return out;
};

/**
 * Every stored ride of one road, measured the way its type is measured
 * (`roadMetrics`): a climb against the marker, a traverse against its two
 * curated ends and its stated length.
 */
const checkRoutes = (p: Pass) => {
  const traverse = isTraverse(p.type);
  for (const [i, a] of p.ascents.entries()) {
    const key = `${p.slug}:${i}`;
    const geom = routes?.[key];
    if (!geom) {
      if (routes && !(rejected && key in rejected))
        warnings.push(`${key}: Route fehlt (bun run data:build)`);
      continue;
    }
    let m = roadMetrics(traverse, geom, a, { lat: p.lat, lon: p.lon });
    const prof = profiles?.[key];
    // The profile only feeds the climb metrics; a traverse is judged on
    // length and ends, which the geometry alone already carries.
    if (prof && !traverse)
      m = withProfile(m as AscentMetrics, prof, p.elevation);
    else if (profiles && !prof) warnings.push(`${key}: Profil fehlt`);
    inspect(
      key,
      `${p.name} ab ${a.label}`,
      m,
      checkRoadAscent(traverse, m, a.check),
    );
  }
};

const checkPasses = (list: Pass[]) => {
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

    warnings.push(...summitWarnings(p));

    // Every type but `pass` is a road summit by definition, so saying it again
    // is a flag nobody maintains rather than a fact anybody reads.
    if (p.roadSummit && p.type !== "pass")
      warnings.push(
        `${p.slug}: roadSummit ist bei einer ${ROAD_TYPE[p.type].label} selbstverständlich – Zeile entfernen`,
      );

    checkRoutes(p);
    if (climate && !(p.slug in climate))
      warnings.push(`${p.slug}: Klimareihe fehlt`);
    if (photos && !(`pass:${p.slug}` in photos))
      warnings.push(`${p.slug}: keine Fotos (bun run data:photos)`);
  }
};

const checkTours = (list: Tour[], spurs: Set<string>, slugs: Set<string>) => {
  dupes(list, "Touren");
  for (const t of list) {
    for (const s of t.passes) {
      if (!slugs.has(s)) errors.push(`Tour ${t.slug}: unbekannter Pass ${s}`);
      // A road that ends at its summit cannot be crossed, so a tour listing it
      // either has the wrong pass or the pass is wrongly marked.
      else if (spurs.has(s))
        warnings.push(
          `Tour ${t.slug}: ${s} ist eine Stichstraße – eine Runde kann dort nicht hinüber`,
        );
    }
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
};

const checkTowns = (list: Town[]) => {
  dupes(list, "Orte");
  // Unlike a pass alias, a town alias may be shared: a valley name legitimately
  // covers several bases ("Wallis" is Brig and Martigny, and a planner wants
  // both). What must not happen is an alias that hides behind another town's
  // name, or one a town gives itself twice.
  const names = new Map<string, string>();
  for (const t of list) {
    const key = fold(t.name);
    const other = names.get(key);
    if (other) errors.push(`${t.slug}: Name fällt mit ${other} zusammen`);
    else names.set(key, t.slug);
  }
  for (const t of list) {
    const seen = new Set<string>();
    for (const alias of t.aliases ?? []) {
      const key = fold(alias);
      const owner = names.get(key);
      if (owner === t.slug || seen.has(key))
        errors.push(`${t.slug}: Alias "${alias}" doppelt (Name oder Alias)`);
      else if (owner) errors.push(`${t.slug}: Alias "${alias}" ist ${owner}`);
      seen.add(key);
    }
    if (new Set(t.tags).size !== t.tags.length)
      errors.push(`${t.slug}: Merkmal doppelt (tags)`);
    if (t.tags.length > 4)
      warnings.push(
        `${t.slug}: ${t.tags.length} Merkmale – mehr als vier sagen nichts mehr aus`,
      );
  }
};

if (passes) checkPasses(passes);
// Without a valid pass list every reference would read as unknown.
if (tours && passes)
  checkTours(
    tours,
    new Set(passes.filter((p) => p.type === "spur").map((p) => p.slug)),
    new Set(passes.map((p) => p.slug)),
  );
if (towns) checkTowns(towns);

// Rejections are unfinished curation: either the coordinates in data/*.json are
// wrong, or a limit in validate.ts is. Both need a human, neither blocks a merge.
// The stored reasons are history; the verdict is recomputed against the current
// limits and the entry's own `check`, so a changed threshold shows up here.
const checkFor = new Map<
  string,
  Pass["ascents"][number]["check"] | Tour["check"]
>();
/** Ascent keys of the types whose rides are measured as a traverse, see `roadMetrics`. */
const traverseKeys = new Set<string>();
for (const p of passes ?? [])
  for (const [i, a] of p.ascents.entries()) {
    const key = ascentKey(p.slug, i);
    checkFor.set(key, a.check);
    if (isTraverse(p.type)) traverseKeys.add(key);
  }
for (const t of tours ?? []) checkFor.set(tourKey(t.slug), t.check);

const rejudge = (key: string, r: RouteRejection) =>
  key.startsWith("tour:")
    ? checkTour(r.metrics as TourMetrics, checkFor.get(key) as Tour["check"])
    : checkRoadAscent(traverseKeys.has(key), r.metrics, checkFor.get(key));

for (const [key, r] of Object.entries(rejected ?? {})) {
  const now = rejudge(key, r);
  const where = key.startsWith("tour:") ? "der Tour" : "der Auffahrt";
  // A rejection next to a stored route is the ORS candidate that failed to
  // replace an OSRM route; the OSRM route stays on the map.
  const kept = routes && key in routes ? (meta?.[key]?.source ?? "osrm") : null;
  const what = kept ? `${r.source}-Kandidat abgewiesen` : "abgewiesen";
  warnings.push(
    now.length
      ? `${key}: ${what} seit ${r.firstSeen} (${days(r.firstSeen)} Tage, ${r.source}) – ${now.join("; ")}${kept ? `; die ${kept}-Route bleibt` : ""}\n       Koordinaten in data/*.json korrigieren oder check an ${where} mit Begründung setzen – der nächste Lauf versucht es dann von selbst (erzwingen: bun run data:build --retry-rejected)`
      : `${key}: ${what} seit ${r.firstSeen}, würde mit den heutigen Grenzen bestehen – der nächste bun run data:build versucht es erneut`,
  );
  if (EXPLAIN)
    explained.push(
      `${now.length ? "✗" : "↺"} ${key.padEnd(36)} ${r.source.padEnd(4)} ${JSON.stringify(r.metrics)} (${what}${now.length ? "" : ", würde jetzt bestehen"})`,
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
  // Photos are keyed by entity, not by route: `pass:…`, `tour:…`, `town:…`.
  const entityKeys = new Set([
    ...passes.map((p) => `pass:${p.slug}`),
    ...tours.map((t) => `tour:${t.slug}`),
    ...(towns ?? []).map((t) => `town:${t.slug}`),
  ]);
  for (const key of Object.keys(photos ?? {}))
    if (!entityKeys.has(key))
      warnings.push(`photos.json: verwaiste Fotos ${key}`);
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
