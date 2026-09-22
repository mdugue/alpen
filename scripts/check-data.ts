#!/usr/bin/env bun
import { insideOf, isMember } from "../lib/destination";
import { haversine } from "../lib/geo";
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
 * What it says about a key that is missing something, it says from the build's
 * own plan (`scripts/lib/decide.ts`): the verdicts here are the ones the next
 * `data:build` will act on, not a second derivation of them. That is why a
 * profile is not asked for behind a marker the build refuses to route to.
 *
 * Errors and warnings are split by what they protect. A stored route that fails
 * a check is an error: that is the invariant, nothing wrong is served. What is
 * merely missing is a warning, because it is unfinished work rather than a
 * regression – a coordinate to fix, an `ascent.check` to set, a limit to
 * revisit, or simply a run of `data:build` that has not happened yet – and it
 * must neither block a merge nor stop the refresh workflow from committing
 * what it fetched.
 */
import {
  inBox,
  isTraverse,
  RANGE,
  RANGE_BOUNDS,
  rangeOf,
  ROAD_TYPE,
  surfaceOfRoads,
} from "../lib/regions";
import type { RangeName } from "../lib/regions";
import { ascentKey, entityKey, parseRouteKey, tourKey } from "../lib/route-key";
import { FILES } from "../lib/schema";
import type { DataFileName } from "../lib/schema";
import { fold } from "../lib/search";
import { windowText } from "../lib/status";
import type {
  AscentMetrics,
  Destination,
  Pass,
  RouteMetrics,
  RouteRejection,
  Tour,
  TourMetrics,
  Town,
} from "../lib/types";
import { renderJsonSchema, schemaFileFor } from "./emit-json-schema";
import { readData } from "./lib/data-files";
import type { Data } from "./lib/data-files";
import { judge, measure, plan } from "./lib/decide";
import type {
  ProfileVerdict,
  RouteJob,
  RouteVerdict,
  Stored,
} from "./lib/decide";
import { ORS_KEY } from "./lib/hosts";
import { misquotedIn } from "./lib/quoted";
import {
  checkRoadAscent,
  checkTour,
  limitsJudged,
  suspectPoint,
  withProfile,
} from "./lib/validate";

const DATA = new URL("../data/", import.meta.url);
const EXPLAIN = process.argv.includes("--explain");
const errors: string[] = [];
const warnings: string[] = [];
const explained: string[] = [];

// ── 1. Shape: every file against its schema ──────────────────────────────────

/** Whatever the file says, plus its problems on the error list. */
const load = async <K extends DataFileName>(
  file: K,
): Promise<Data<K> | null> => {
  const { data, problems } = await readData(file);
  errors.push(...problems);
  return data;
};

const [
  passes,
  tours,
  towns,
  destinations,
  routes,
  profiles,
  climate,
  meta,
  rejected,
  summits,
  photos,
  passesEn,
  toursEn,
  townsEn,
  destinationsEn,
] = await Promise.all([
  load("passes.json"),
  load("tours.json"),
  load("towns.json"),
  load("destinations.json"),
  load("generated/routes.json"),
  load("generated/profiles.json"),
  load("generated/climate.json"),
  load("generated/routes-meta.json"),
  load("generated/rejected.json"),
  load("generated/summits.json"),
  load("generated/photos.json"),
  load("i18n/en/passes.json"),
  load("i18n/en/tours.json"),
  load("i18n/en/towns.json"),
  load("i18n/en/destinations.json"),
]);

for (const file of Object.keys(FILES) as DataFileName[]) {
  const target = Bun.file(new URL(`schema/${schemaFileFor(file)}`, DATA));
  const current = (await target.exists()) ? await target.text() : null;
  if (current !== renderJsonSchema(file))
    errors.push(
      `data/schema/${schemaFileFor(file)} ist veraltet (bun run data:schema)`,
    );
}

// The thresholds are restated in prose – the gate's limits in the skill and
// two diagrams, the status constants in docs/scales.md – and a constant that
// moved while the sentence kept the old number is the same kind of staleness
// as the schema files above. `scripts/lib/quoted.ts` says which document
// quotes which constant, and how.
errors.push(...(await misquotedIn(new URL("../", import.meta.url))));

// ── 2. What the next build would do ──────────────────────────────────────────

/**
 * A file that failed its schema reads as empty here, so the plan can still be
 * made for everything else; the warnings that depend on such a file are held
 * back one by one below, and the schema failure is already an error.
 */
const stored: Stored = {
  climates: climate ?? {},
  meta: meta ?? {},
  profiles: profiles ?? {},
  rejected: rejected ?? {},
  routes: routes ?? {},
  summits: summits ?? {},
};
const planned =
  passes && tours
    ? plan(
        { passes, tours },
        stored,
        // The build's own flags, so the verdicts are the ones it would act on.
        // `--only` does not apply: a check reports on everything.
        {
          only: undefined,
          ors: ORS_KEY !== "",
          retryRejected: false,
          upgradeOsrm: false,
        },
      )
    : null;
const jobs = new Map<string, RouteJob>(
  planned?.routes.map(({ job }) => [job.key, job]),
);
const routeVerdict = new Map<string, RouteVerdict>(
  planned?.routes.map(({ job, verdict }) => [job.key, verdict]),
);
const profileVerdict = new Map<string, ProfileVerdict>(
  planned?.profiles.map(({ job, verdict }) => [job.key, verdict]),
);
/** A key the next build will ask the router about, missing route or not. */
const willFetch = (key: string) => {
  const act = routeVerdict.get(key)?.act;
  return act === "fetch" || act === "retry";
};

/**
 * The measured values of one route, keys in a fixed order. A rejection keeps
 * them as the run that wrote it spelled them, and two lines of this listing
 * have to be comparable by eye – the freshly measured ones and the stored ones
 * alike.
 */
const values = (m: RouteMetrics) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(m).toSorted(([a], [b]) => (a < b ? -1 : 1)),
    ),
  );

const days = (iso: string) =>
  Math.round((Date.now() - Date.parse(iso)) / 86_400_000);

/**
 * Shared by ascents and tours: judge what is stored, note where it came from,
 * and compare what it was fetched for against what is asked for today.
 */
const inspect = (
  key: string,
  label: string,
  metrics: RouteMetrics,
  reasons: string[],
  /** The hash of today's question; `undefined` skips the comparison. */
  inputs?: string,
) => {
  const entry = meta?.[key];
  const source = entry?.source ?? "osrm";
  if (reasons.length)
    errors.push(
      `${key}: gespeicherte Route ist unplausibel – ${reasons.join("; ")} (${label})`,
    );
  // An OSRM route whose ORS candidate was refused is reported with that
  // rejection below, not as "erneuern": ORS has been asked. So is one ORS
  // answered 404 for – its road-cycling graph does not carry this road, and
  // asking again on every run costs a request to hear the same thing.
  else if (
    source === "osrm" &&
    !entry?.orsDeclined &&
    !(rejected && key in rejected)
  )
    warnings.push(
      `${key}: Route stammt vom OSRM-Autoprofil – mit ORS_KEY erneuern`,
    );
  // The stored geometry answers the question of the day it was fetched. A
  // moved coordinate leaves it in place – it may even still pass the checks
  // above, a few hundred metres short of where the marker now is.
  if (
    inputs !== undefined &&
    entry?.inputs !== undefined &&
    entry.inputs !== inputs
  )
    warnings.push(
      `${key}: Route wurde für andere Eingaben geholt (Koordinaten, Höhe oder check geändert) – bun run data:build holt sie neu`,
    );
  if (EXPLAIN)
    explained.push(
      `${reasons.length ? "✗" : "·"} ${key.padEnd(36)} ${source.padEnd(4)} ${values(metrics)}${reasons.length ? `\n      ${reasons.join("\n      ")}` : ""}`,
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

/** What the marker of this entry says about itself, in the words of its type. */
const summitWarnings = (p: Pass): string[] =>
  suspectPoint(
    {
      elevation: p.elevation,
      lat: p.lat,
      lon: p.lon,
      slug: p.slug,
      type: p.type,
    },
    summits?.[p.slug],
  )?.reasons.map((r) => `${p.slug}: ${r.text}`) ?? [];

/**
 * Every stored ride of one road, measured the way its type is measured: a
 * climb against the marker, a traverse against its two curated ends and its
 * stated length – both through the same `measure`/`judge` pair the build uses.
 */
const checkRoutes = (p: Pass) => {
  const traverse = isTraverse(p.type);
  for (const [i, a] of p.ascents.entries()) {
    const key = ascentKey(p.slug, i);
    const job = jobs.get(key);
    const geom = routes?.[key];
    if (!(job && geom)) {
      // A missing route is backlog, never a regression: it is either one the
      // next build fetches, a rejection (reported below) or a ride behind a
      // marker the build refuses to route to (reported above).
      if (routes && willFetch(key))
        warnings.push(
          `${key}: Route fehlt – der nächste bun run data:build holt sie`,
        );
      continue;
    }
    let m = measure(job, geom);
    const prof = profiles?.[key];
    // The profile only feeds the climb metrics; a traverse is judged on
    // length and ends, which the geometry alone already carries.
    if (prof && !traverse)
      m = withProfile(m as AscentMetrics, prof, p.elevation);
    else if (profiles && !prof && profileVerdict.get(key)?.act !== "blocked")
      warnings.push(`${key}: Profil fehlt`);
    inspect(key, `${p.name} ab ${a.label}`, m, judge(job, m), job.inputs);
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

    // Every type but `pass` is a road summit by definition, so `hasRoadSummit`
    // never reads the flag there. `true` is a fact nobody maintains, and
    // `false` is worse: it reads as "kein Straßenscheitel" and does nothing.
    if (p.roadSummit !== undefined && p.type !== "pass")
      warnings.push(
        `${p.slug}: roadSummit wird bei einer ${ROAD_TYPE[p.type].label} nicht gelesen – der Scheitel liegt dort immer auf der Straße; Zeile entfernen`,
      );

    checkRoutes(p);
    if (climate && !(p.slug in climate))
      warnings.push(`${p.slug}: Klimareihe fehlt`);
    if (photos && !(entityKey("pass", p.slug) in photos))
      warnings.push(`${p.slug}: keine Fotos (bun run data:photos)`);
  }
};

/**
 * A loop is ridden with what its roads demand: gravel or mixed the moment one
 * member is (plan 27). Written down rather than derived, so the file can say
 * more than its roads do – and held to at least what they say here.
 */
const checkTourSurface = (t: Tour, byPass: Map<string, Pass>) => {
  const surfaces = t.passes
    .map((s) => byPass.get(s)?.surface)
    .filter((x) => x !== undefined);
  // At least what the roads say: a loop may declare more gravel than its
  // roads (the connecting stretches), never less.
  const expected = surfaceOfRoads(surfaces);
  if (surfaces.length && t.surface === "asphalt" && expected !== "asphalt")
    errors.push(
      `Tour ${t.slug}: surface "asphalt" – ihre Pässe verlangen mindestens "${expected}"`,
    );
};

const checkTours = (list: Tour[], byPass: Map<string, Pass>) => {
  dupes(list, "Touren");
  for (const t of list) {
    // A loop has no region of its own: its range is its passes', which have
    // to agree on one, and its waypoints lie in that range's box – the same
    // typo guard the schema holds a road's marker to (`RANGE_BOUNDS`).
    const ranges = new Set<RangeName>();
    for (const s of t.passes) {
      const p = byPass.get(s);
      if (p) ranges.add(rangeOf(p.region));
    }
    if (ranges.size > 1)
      errors.push(
        `Tour ${t.slug}: Pässe aus ${[...ranges].map((r) => RANGE[r].label).join(" und ")} – eine Runde liegt in einem Gebirge`,
      );
    const [range] = ranges;
    if (range) {
      const box = RANGE_BOUNDS[range];
      for (const [i, w] of t.waypoints.entries())
        if (!inBox(box, w))
          errors.push(
            `Tour ${t.slug}: Wegpunkt ${i} liegt ${RANGE[range].outside} (${box.lat.join("–")}° N, ${box.lon.join("–")}° E)`,
          );
    }
    for (const s of t.passes) {
      const p = byPass.get(s);
      if (!p) {
        errors.push(`Tour ${t.slug}: unbekannter Pass ${s}`);
        continue;
      }
      // A road that ends at its summit cannot be crossed, so a tour listing it
      // either has the wrong pass or the pass is wrongly marked.
      if (p.type === "spur")
        warnings.push(
          `Tour ${t.slug}: ${s} ist eine Stichstraße – eine Runde kann dort nicht hinüber`,
        );
      // A loop's own window may narrow what its passes allow, never widen it:
      // a loop that claims to open in May over a pass that opens in June says
      // something its passes contradict, and the strip would show the pass.
      if (
        t.season &&
        p.season &&
        (t.season.opens < p.season.opens || t.season.closes > p.season.closes)
      )
        warnings.push(
          `Tour ${t.slug}: Fenster ${windowText(t.season)} reicht über das von ${s} (${windowText(p.season)}) hinaus – die Runde kann nicht länger offen sein als ihr Pass`,
        );
    }
    checkTourSurface(t, byPass);
    const key = tourKey(t.slug);
    const job = jobs.get(key);
    const geom = routes?.[key];
    if (!(job && geom)) {
      if (routes && willFetch(key))
        warnings.push(
          `Tour ${t.slug}: Route fehlt – der nächste bun run data:build holt sie`,
        );
      continue;
    }
    const m = measure(job, geom);
    inspect(key, `Tour ${t.name}`, m, judge(job, m), job.inputs);
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

/**
 * A destination refers to roads and towns by slug, and its lists are
 * corrections to a radius: `include` reaches past it, `exclude` cuts inside
 * it. A correction that the radius already makes is a warning – the list
 * says something the circle says too, and the next radius change will make
 * one of them wrong. Which road belongs to no area at all is printed as
 * information at the end (docs/destinations.md).
 */
const checkDestinations = (
  list: Destination[],
  byPass: Map<string, Pass>,
  byTown: Map<string, Town>,
) => {
  dupes(list, "Reiseziele");
  for (const d of list) {
    const inside = (p: { lat: number; lon: number }) => insideOf(d, p);
    for (const slug of d.baseTowns) {
      const t = byTown.get(slug);
      if (!t) errors.push(`${d.slug}: Standort ${slug} unbekannt`);
      else if (!inside(t))
        warnings.push(
          `${d.slug}: Standort ${slug} liegt ${Math.round(haversine(d.center, t))} km von der Mitte – außerhalb des Radius von ${d.radiusKm} km`,
        );
    }
    for (const slug of d.include) {
      const p = byPass.get(slug);
      if (!p) errors.push(`${d.slug}: include ${slug} unbekannt`);
      else if (inside(p))
        warnings.push(`${d.slug}: include ${slug} liegt ohnehin im Radius`);
      if (d.exclude.includes(slug))
        errors.push(`${d.slug}: ${slug} in include und exclude`);
    }
    for (const slug of d.exclude) {
      const p = byPass.get(slug);
      if (!p) errors.push(`${d.slug}: exclude ${slug} unbekannt`);
      else if (!inside(p))
        warnings.push(`${d.slug}: exclude ${slug} liegt ohnehin außerhalb`);
    }
    if (![...byPass.values()].some((p) => isMember(d, p)))
      errors.push(`${d.slug}: keine Straße im Gebiet`);
  }
};

/** Roads in no area: listed so that "standalone" is a decision, not an oversight. */
const standalone = (list: Destination[], roads: Pass[]): string[] =>
  roads.filter((p) => !list.some((d) => isMember(d, p))).map((p) => p.slug);

if (passes) checkPasses(passes);
// Without a valid pass list every reference would read as unknown.
if (tours && passes) checkTours(tours, new Map(passes.map((p) => [p.slug, p])));
if (towns) checkTowns(towns);
if (destinations && passes && towns)
  checkDestinations(
    destinations,
    new Map(passes.map((p) => [p.slug, p])),
    new Map(towns.map((t) => [t.slug, t])),
  );

// Rejections are unfinished curation: either the coordinates in data/*.json are
// wrong, or a limit in validate.ts is. Both need a human, neither blocks a merge.
// The stored reasons are history; the verdict is recomputed against the current
// limits and the entry's own `check`, so a changed threshold shows up here.
/** Measured the way a tour is: a traverse ride, a tour, or an orphaned tour key. */
const asTour = (key: string) => {
  const job = jobs.get(key);
  return job ? job.kind !== "ascent" : parseRouteKey(key)?.kind === "tour";
};
const rejudge = (key: string, r: RouteRejection) => {
  const job = jobs.get(key);
  if (job) return judge(job, r.metrics);
  // An orphan: no pass or tour claims this key any more, so there is no
  // `check` to widen anything and the key itself says how it was measured.
  return asTour(key)
    ? checkTour(r.metrics as TourMetrics)
    : checkRoadAscent(false, r.metrics);
};

for (const [key, r] of Object.entries(rejected ?? {})) {
  const now = rejudge(key, r);
  const where =
    parseRouteKey(key)?.kind === "tour" ? "der Tour" : "der Auffahrt";
  // A rejection next to a stored route is the ORS candidate that failed to
  // replace an OSRM route; the OSRM route stays on the map.
  const kept = routes && key in routes ? (meta?.[key]?.source ?? "osrm") : null;
  const what = kept ? `${r.source}-Kandidat abgewiesen` : "abgewiesen";
  // "Would pass today" is a claim about the limits that could actually be
  // read: a candidate that never got a profile carries no top delta, no peak
  // position and no gain, and three of six limits then go unjudged.
  const { judged, unjudged } = limitsJudged(asTour(key), r.metrics);
  const scope = `geprüft: ${judged.join(", ")}${
    unjudged.length ? `; ohne Profil ungeprüft: ${unjudged.join(", ")}` : ""
  }`;
  // What the build would do with this key, asked of the plan rather than
  // guessed: a rejection whose inputs the curator has already changed is
  // queued for a retry, and saying so is the whole promise the automatic
  // rule makes – otherwise the curator is told to force what is already due.
  const queued = routeVerdict.get(key)?.act === "retry";
  warnings.push(
    now.length
      ? `${key}: ${what} seit ${r.firstSeen} (${days(r.firstSeen)} Tage, ${r.source}) – ${now.join("; ")}${kept ? `; die ${kept}-Route bleibt` : ""}\n       ${
          queued
            ? "Koordinaten sind korrigiert – der nächste bun run data:build fragt von selbst neu"
            : `Koordinaten in data/*.json korrigieren oder check an ${where} mit Begründung setzen – der nächste Lauf versucht es dann von selbst (erzwingen: bun run data:build --retry-rejected)`
        }`
      : `${key}: ${what} seit ${r.firstSeen}, würde mit den heutigen Grenzen bestehen (${scope}) – der nächste bun run data:build versucht es erneut`,
  );
  if (EXPLAIN)
    explained.push(
      `${now.length ? "✗" : "↺"} ${key.padEnd(36)} ${r.source.padEnd(4)} ${values(r.metrics)} (${what}${now.length ? (queued ? ", Eingaben geändert – wird neu gefragt" : "") : `, würde jetzt bestehen – ${scope}`})`,
    );
}

// Generated keys that no longer belong to a pass or tour are stale, not wrong.
if (passes && tours) {
  const ascentKeys = new Set(
    passes.flatMap((p) => p.ascents.map((_, i) => ascentKey(p.slug, i))),
  );
  // Routes exist for ascents and tours, profiles for ascents only.
  const routeKeys = new Set([
    ...ascentKeys,
    ...tours.map((t) => tourKey(t.slug)),
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
    ...passes.map((p) => entityKey("pass", p.slug)),
    ...tours.map((t) => entityKey("tour", t.slug)),
    ...(towns ?? []).map((t) => entityKey("town", t.slug)),
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
// Information, not a warning: a pass carries every side that is a classic
// climb, and a single-sided one says in its note why the other side is not
// (a motorway feeder, a gravel track, a tunnel). The count is printed in every
// data PR so the number stays visible; the note is the honest state for many
// of them, so nothing here nags (docs/plans/24-depth-per-destination.md).
const singleSided = (passes ?? []).filter(
  (p) => p.type === "pass" && p.ascents.length === 1,
).length;
// Also information: a road outside every destination is fine when it is a
// lone road nobody would build a holiday around, and a gap in the areas when
// it is not. The list makes that a decision the curator sees.
const alone = passes && destinations ? standalone(destinations, passes) : [];
// The snow cover closes an unpaved road (plan 27); a series without it grades
// such a road by every other rung and never closes it. Counted, not warned:
// the archive has not been asked for it yet, and that is a run, not a bug.
const series = Object.values(climate ?? {});
const withCover = series.filter((c) =>
  c.some((b) => b?.coverPct !== undefined),
);
if (series.length && withCover.length < series.length)
  console.log(
    `INFO  Schneedecke (coverPct) fehlt in ${series.length - withCover.length} von ${series.length} Klimareihen – ungeteerte Straßen werden bis zum Archivlauf nie „gesperrt“`,
  );
if (alone.length)
  console.log(
    `INFO  ${alone.length} Straßen in keinem Reiseziel: ${alone.join(", ")}`,
  );
// The English prose (plan 08): a missing field falls back to German in the
// English UI, so the gap is counted rather than failed – and an entry for a
// slug that no longer exists is a warning, like any other orphan.
const translationGaps: string[] = [];
const coverage = (
  what: string,
  list: { slug: string }[] | null,
  translations: Record<string, object> | null,
  fields: string[],
) => {
  if (!list || !translations) return;
  const slugs = new Set(list.map((x) => x.slug));
  for (const key of Object.keys(translations))
    if (!slugs.has(key))
      warnings.push(`i18n/en/${what}.json: verwaister Eintrag ${key}`);
  for (const field of fields) {
    const missing = list.filter(
      (x) =>
        (x as Record<string, unknown>)[field] !== undefined &&
        (translations[x.slug] as Record<string, unknown> | undefined)?.[
          field
        ] === undefined,
    ).length;
    if (missing)
      translationGaps.push(`${what}.${field} ${missing}/${list.length}`);
  }
};
coverage("passes", passes, passesEn, ["note", "classicAscent"]);
// The ascent labels are matched by index, so a list of the wrong length
// would put a label on the wrong side – a warning, unlike a missing field.
for (const p of passes ?? []) {
  const labels = passesEn?.[p.slug]?.ascents;
  if (labels && labels.length !== p.ascents.length)
    warnings.push(
      `i18n/en/passes.json: ${p.slug} hat ${labels.length} Auffahrtsnamen, die Straße ${p.ascents.length}`,
    );
}
if (passes && passesEn) {
  const missing = passes.filter((p) => !passesEn[p.slug]?.ascents).length;
  if (missing)
    translationGaps.push(`passes.ascents ${missing}/${passes.length}`);
}
coverage("tours", tours, toursEn, ["description", "note"]);
coverage("towns", towns, townsEn, ["why"]);
coverage("destinations", destinations, destinationsEn, [
  "character",
  "multiDay",
  "access",
  "note",
]);
if (translationGaps.length)
  console.log(
    `INFO  Englische Texte fehlen (Rückfall auf Deutsch): ${translationGaps.join(", ")}`,
  );
console.log(
  `${passes?.length ?? 0} Pässe (${singleSided} davon einseitig), ${tours?.length ?? 0} Touren, ${towns?.length ?? 0} Orte, ${destinations?.length ?? 0} Reiseziele · ${Object.keys(routes ?? {}).length} Routen geprüft${
    rejectedCount ? `, ${rejectedCount} abgewiesen` : ""
  } · ${errors.length} Fehler, ${warnings.length} Warnungen`,
);
if (errors.length) process.exit(1);
