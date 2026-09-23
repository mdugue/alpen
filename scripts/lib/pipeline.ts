/**
 * The build's three steps, as one function: `plan` decides, the pipelines
 * below execute through a `Transport`, and `afterGate` turns each verdict into
 * the records that follow from it.
 *
 * It lives beside the decisions rather than inside `scripts/build-data.ts`
 * because the interesting half of it – a candidate that fails the gate next to
 * a route that already passed, a rejection that keeps its measured values, a
 * profile that is not paid for twice – is reachable in production only through
 * a live run on a road one router refuses. Here it is a function of its
 * arguments: hand it a fixture transport and the whole gate runs offline in
 * `bun test` (`scripts/pipeline.test.ts`).
 *
 * What stays in the script is what only a run has: the command line, the live
 * transport with its budgets, and the lines a run prints about the hosts it
 * talked to.
 */
import {
  PROFILE_POINTS,
  profileCoords,
  profileDistances,
  profileStats,
  withRoadDistances,
} from "../../lib/profile";
import type {
  AscentMetrics,
  ElevationProfile,
  LatLon,
  Pass,
  RouteGeometry,
  RouteSource,
  Summit,
} from "../../lib/types";
import { bucketClimate } from "./climate";
import { writeData } from "./data-files";
import {
  afterDecline,
  afterGate,
  judge,
  measure,
  ofRoad,
  plan,
  secondGraph,
  storedFor,
} from "./decide";
import type {
  Counts,
  Curated,
  Flags,
  Judged,
  RouteJob,
  Stored,
} from "./decide";
import { CLIMATE_WEIGHT, openMeteo, ors, osrm } from "./hosts";
import { distanceToWays, ROAD_RADIUS } from "./locate";
import { osmSource } from "./osm";
import { HttpError, QuotaExhaustedError } from "./transport";
import type { HostId, Transport } from "./transport";
import { geometryHash, withProfile } from "./validate";
import type { RoutingProfile, SECOND_GRAPH } from "./validate";

/** `[3/40]` against the pipeline's own total, dispatch order (not completion order). */
const counter = (total: number) => (i: number) => `[${i + 1}/${total}]`;

/** The binding Open-Meteo limit in practice: 5 000 calls/h ≈ 50 elevation profiles. */
const OPEN_METEO_HOURLY = 5000;
/**
 * What one profile costs, for the estimate in `reportLine`. Open-Meteo bills
 * one call per location and `openMeteo.elevation` charges exactly that, so
 * this is the cap `profileCoords` samples to – the estimate can only be an
 * upper bound, since a geometry with fewer points than the cap is cheaper.
 */
const PROFILE_WEIGHT = PROFILE_POINTS;

/**
 * The one sentence `--status`, `--pending` and both ends of a run render from.
 *
 * What is always there is the head: the five counts of what is missing, zero
 * included, and behind them the call estimate as soon as anything would be
 * paid for. What follows are the caveats, one clause each, separated by `·`
 * and written only when their count is not zero – a run with nothing to
 * caveat ends after the head.
 */
export const reportLine = (
  c: Counts,
  opts: { budget: number; upgradeOsrm: boolean },
): string => {
  const calls =
    c.newProfiles * PROFILE_WEIGHT + c.climate * CLIMATE_WEIGHT + c.summits;
  const head = `Fehlend: ${c.routes} Routen, ${c.profiles} Profile, ${c.climate} Klimareihen, ${c.summits} Gipfelhöhen, ${c.roads} Straßenabstände${
    calls
      ? ` (≈ ${calls} Open-Meteo-Calls ≈ ${Math.ceil(calls / Math.min(opts.budget, OPEN_METEO_HOURLY))} Läufe à ${opts.budget})`
      : ""
  }`;

  const clauses: string[] = [];
  if (c.rejected) clauses.push(`${c.rejected} abgewiesen (rejected.json)`);
  if (c.stale) clauses.push(`${c.stale} veraltet (Koordinaten verschoben)`);
  if (c.upgradable && !opts.upgradeOsrm)
    clauses.push(`${c.upgradable} OSRM-Routen aufrüstbar (--upgrade-osrm)`);
  if (c.kept)
    clauses.push(
      `${c.kept} davon OSRM-Routen, deren ORS-Kandidat abgewiesen wurde`,
    );
  if (c.blocked)
    clauses.push(
      `${c.blocked} Auffahrten warten auf eine korrigierte Passkoordinate (Höhe oder Straßenabstand)`,
    );

  return [head, ...clauses].join(" · ");
};

/** Takes the parts of the state that changed wherever they are kept. */
export type Save = (
  state: Stored,
  parts?: readonly (keyof Stored)[],
) => Promise<void>;

/** Which file each part of the state lives in – the only place that pairing exists. */
const FILE_OF: Record<keyof Stored, (s: Stored, dir?: URL) => Promise<void>> = {
  climates: (s, dir) => writeData("generated/climate.json", s.climates, dir),
  meta: (s, dir) => writeData("generated/routes-meta.json", s.meta, dir),
  profiles: (s, dir) => writeData("generated/profiles.json", s.profiles, dir),
  rejected: (s, dir) => writeData("generated/rejected.json", s.rejected, dir),
  routes: (s, dir) => writeData("generated/routes.json", s.routes, dir),
  summits: (s, dir) => writeData("generated/summits.json", s.summits, dir),
};
const PARTS = Object.keys(FILE_OF) as (keyof Stored)[];

/**
 * Writes into `data/`, or into another directory – a test writes its own and
 * reads the files back. Every file is validated against its schema first
 * (`writeData`): a malformed upstream answer must never reach the repo.
 */
export const saveTo =
  (dir?: URL): Save =>
  async (state, parts = PARTS) => {
    for (const part of parts) await FILE_OF[part](state, dir);
  };

export interface PipelineOptions {
  curated: Curated;
  flags: Flags;
  log: (line: string) => void;
  save: Save;
  /**
   * The state the run starts from; every decision is written into it, so the
   * caller reads the outcome off the same object.
   */
  state: Stored;
  /** Why a host has stopped answering for this run – `null` while it answers. */
  stopped: (host: HostId) => string | null;
  /** ISO date of this run, stamped onto everything it writes. */
  today: string;
  transport: Transport;
}

export const runPipeline = async ({
  curated,
  flags,
  log,
  save,
  state,
  stopped,
  today,
  transport,
}: PipelineOptions): Promise<void> => {
  /**
   * Takes a decision into the state and onto disk. Writes are chained so two
   * concurrent pipelines never interleave a file write.
   */
  let writing: Promise<unknown> = Promise.resolve();
  const commit = (next: Partial<Stored>) => {
    Object.assign(state, next);
    const parts = Object.keys(next) as (keyof Stored)[];
    writing = writing.then(() => save(state, parts));
    return writing;
  };

  const fail = (what: string, e: unknown) =>
    log(`  ${what} FEHLER ${(e as Error).message}`);

  // ── The hosts ──────────────────────────────────────────────────────────────

  /**
   * ORS first, OSRM as the fallback – for the two reasons ORS legitimately has
   * no answer:
   *
   * - the daily quota is spent, and
   * - ORS refuses this geometry. Its road-cycling graph leaves out roads it
   *   does not consider fit for a road bike, and then answers 404: no route
   *   between the points (2009) or no routable point near one of them (2010).
   *   The URL is a constant, so a 404 here can only be the routing question,
   *   never a wrong address. Without this branch such a road is skipped on
   *   every run for ever – it is never stored, so nothing marks it as needing
   *   a retry.
   *
   * Both fall through to the car profile, and the gate judges what comes back
   * the same way it judges an ORS route: a car route that cuts a corner the
   * road does not take fails on length, on its end point or on where its
   * summit lies. That is how Finestre and Nivolet are on the map.
   */
  const route = async (
    label: string,
    waypoints: LatLon[],
    profile: RoutingProfile,
  ): Promise<{
    declined: boolean;
    geom: RouteGeometry;
    source: RouteSource;
  }> => {
    let declined = false;
    if (flags.ors && !stopped("ors")) {
      try {
        return {
          declined,
          geom: await ors.route(transport, waypoints, profile),
          source: "ors",
        };
      } catch (error) {
        if (error instanceof QuotaExhaustedError)
          log(
            `  ORS-Kontingent erschöpft: ${label} – weiter mit OSRM (Autoprofil), das Gate fängt die Ausreißer ab`,
          );
        else if (error instanceof HttpError && error.status === 404) {
          declined = true;
          log(
            `  ORS fährt diese Straße nicht: ${label} – weiter mit OSRM (Autoprofil), das Gate fängt die Ausreißer ab`,
          );
        } else throw error;
      }
    }
    // The fallback is a car profile: on a gravel road it will refuse the
    // track or drive round it, and the gate will say so. Expected, not an
    // upgrade candidate – the line names it so nobody reads it as a miss.
    if (profile !== "cycling-road")
      log(
        `  Schotter ohne ORS: ${label} – OSRM (Autoprofil) fährt Tracks meist nicht, das Gate weist die Route dann ab`,
      );
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

  const osm = osmSource({ log, transport });

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

  /**
   * The second question `secondGraph` allows: the same waypoints on ORS's
   * everyday cycling graph. Its answer replaces the first only when it passes
   * the geometry checks the first one failed – a second detour teaches
   * nothing, and the first answer's reasons are the ones a rejection keeps. A
   * 404 or a spent quota leaves the first answer to the gate, as it was.
   */
  const secondTry = async (
    tag: string,
    job: RouteJob,
    first: { geom: RouteGeometry; source: RouteSource },
  ): Promise<{ geom: RouteGeometry; orsProfile?: typeof SECOND_GRAPH }> => {
    const graph = secondGraph(
      job,
      first.source,
      judge(job, measure(job, first.geom)),
    );
    if (!graph || stopped("ors")) return { geom: first.geom };
    try {
      const geom = await ors.route(transport, job.waypoints, graph);
      if (judge(job, measure(job, geom)).length) {
        log(
          `${tag} Zweiter Versuch (${graph}) ebenso abgewiesen: ${job.label}`,
        );
        return { geom: first.geom };
      }
      log(
        `${tag} Zweiter Versuch (${graph}): ${job.label} – der Rennradgraph fuhr um die Straße herum`,
      );
      return { geom, orsProfile: graph };
    } catch (error) {
      if (
        error instanceof QuotaExhaustedError ||
        (error instanceof HttpError && error.status === 404)
      )
        return { geom: first.geom };
      throw error;
    }
  };

  // ── The gate ───────────────────────────────────────────────────────────────

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
    /** The candidate came from ORS's second graph, not the road's own. */
    orsProfile?: typeof SECOND_GRAPH,
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
      orsProfile,
      source,
      today,
    };
    let m = measure(job, geom);

    const reject = async (reasons: string[], judged: Partial<Judged> = {}) => {
      await commit(
        afterGate(job, state, { ...base, metrics: m, reasons, ...judged }),
      );
      log(
        `${tag} Abgewiesen: ${job.label} (${source}${orsProfile ? `, ${orsProfile}` : ""})${unchanged ? " – unveränderte Geometrie, die Koordinaten sind das Problem" : ""}${
          keep
            ? ` – die gespeicherte ${keep.meta?.source ?? "osrm"}-Route bleibt`
            : ""
        }\n${reasons.map((r) => `    ${r}`).join("\n")}`,
      );
    };
    const accepted = async () => {
      await commit(afterGate(job, state, { ...base, metrics: m, reasons: [] }));
      log(
        `${tag} Route: ${job.label} (${source}${orsProfile ? `, ${orsProfile}` : ""}, ${(m as AscentMetrics).km} km)`,
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
    const deferred = source === "osrm" && flags.ors && !before;
    if (!ofRoad(job) || deferred) {
      if (fetched) await accepted();
      if (deferred)
        log(
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
        log(
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
    log(
      `${tag} Profil: ${job.label} (${prof.km} km, ${prof.elevationGain} Hm, Gipfel ${prof.top} m)`,
    );
  };

  // ── The pipelines ──────────────────────────────────────────────────────────

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
        log(`Gipfelhöhen: ${todo.length} gemessen`);
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
        log(`Straßenabstände: ${roads.length} gemessen`);
      } catch (error) {
        fail("Straßenabstände", error);
      }
    const measured = new Set([...todo, ...roads].map((p) => p.slug));
    for (const { finding, pass } of plan(curated, state, flags).findings)
      if (measured.has(pass.slug) && finding.reasons.some((r) => r.blocks))
        log(
          `${finding.words.marker} auffällig: ${pass.slug} – die ${finding.words.rides} werden nicht geroutet (bun run data:locate ${pass.slug})`,
        );
  }

  const todo = plan(curated, state, flags);

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
        const first = await route(job.label, job.waypoints, job.profile);
        const { declined, source } = first;
        if (upgrade && (state.meta[job.key]?.source ?? "osrm") === source) {
          const next = afterDecline(job, state, declined);
          if (next) {
            await commit(next);
            if (declined)
              log(
                `${tag} ORS hat diese Straße endgültig abgelehnt: ${job.label} – die OSRM-Route bleibt, data:check verlangt keine Aufrüstung mehr`,
              );
          }
          return;
        }
        const { geom, orsProfile } = await secondTry(tag, job, first);
        await gate(tag, job, geom, source, true, declined, replace, orsProfile);
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
  const climating = todo.climate.map(async (pass, i, all) => {
    const tag = counter(all.length)(i);
    try {
      const daily = await openMeteo.archive(transport, pass);
      await commit({
        climates: { ...state.climates, [pass.slug]: bucketClimate(daily) },
      });
      log(`${tag} Klima: ${pass.name}`);
    } catch (error) {
      if (!(error instanceof QuotaExhaustedError))
        fail(`${tag} Klima ${pass.name}`, error);
    }
  });

  await Promise.all([...routing, ...profiling, ...climating]);
  await writing;
};
