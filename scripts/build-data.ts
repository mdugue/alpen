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
 * needs; `runPipeline` (scripts/lib/pipeline.ts) executes them through the
 * hosts and turns each verdict into the records that follow from it. This file
 * is what only a run has: the command line, the live transport with its
 * budgets, and the lines about the hosts it talked to. Every rule about *when*
 * something is fetched is in that one pure module, table-tested, and
 * `data:check` reads the same plan – so what it tells the curator about a key
 * is what this script will do with it. The pipeline is tested end to end
 * against recorded answers in scripts/pipeline.test.ts.
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

import { mustRead } from "./lib/data-files";
import { plan } from "./lib/decide";
import type { Flags, Stored } from "./lib/decide";
import { ORS_KEY } from "./lib/hosts";
import { reportLine, runPipeline, saveTo } from "./lib/pipeline";
import { liveTransport } from "./lib/transport";

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

// ── The stored state, read once and validated ────────────────────────────────

await mkdir(new URL("../data/generated/", import.meta.url), {
  recursive: true,
});
const curated = {
  passes: await mustRead("passes.json"),
  tours: await mustRead("tours.json"),
};
const state: Stored = {
  climates: await mustRead("generated/climate.json"),
  meta: await mustRead("generated/routes-meta.json"),
  profiles: await mustRead("generated/profiles.json"),
  rejected: await mustRead("generated/rejected.json"),
  routes: await mustRead("generated/routes.json"),
  summits: await mustRead("generated/summits.json"),
};
const save = saveTo();

// ── The three renderings of one plan ─────────────────────────────────────────

const report = () =>
  console.log(
    reportLine(plan(curated, state, flags).counts, {
      budget: OPEN_METEO_BUDGET,
      upgradeOsrm: UPGRADE_OSRM,
    }),
  );

if (PENDING_ONLY) {
  console.log(plan(curated, state, flags).counts.pending);
  process.exit(0);
}
if (STATUS_ONLY) {
  report();
  process.exit(0);
}
if (FORMAT_ONLY) {
  await save(state);
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
console.log(
  `Open-Meteo-Budget für diesen Lauf: ${OPEN_METEO_BUDGET} Calls (OPEN_METEO_BUDGET)`,
);

await runPipeline({
  curated,
  flags,
  log: (line) => console.log(line),
  save,
  state,
  stopped: (host) => transport.host(host).exhausted,
  today: TODAY,
  transport,
});

// ── What this run cost, and what is left ─────────────────────────────────────

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
